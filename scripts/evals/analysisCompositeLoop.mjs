import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  parentGuidanceSchema,
  parseAnalysisResult,
  parseCoreAnalysisResult,
  studentGuidanceSchema,
  teacherGuidanceSchema,
} from '../../src/lib/schema/analysisSchema.ts'
import {
  buildCoreAnalysisSystemPrompt,
  buildCoreAnalysisUserPrompt,
  buildParentGuidanceSystemPrompt,
  buildParentGuidanceUserPrompt,
  buildStudentGuidanceSystemPrompt,
  buildStudentGuidanceUserPrompt,
  buildTeacherGuidanceSystemPrompt,
  buildTeacherGuidanceUserPrompt,
} from '../../src/lib/analysis/prompt.ts'
import { evalCases } from './cases.mjs'

const DEFAULT_PROXY_TARGET = process.env.GEMMA_PROXY_TARGET?.trim() || 'http://127.0.0.1:11434'

function trimSlash(value) {
  return value.replace(/\/+$/, '')
}

function normalizeBaseUrl(rawBaseUrl) {
  if (!rawBaseUrl || /^\/api\/ollama\/?$/i.test(rawBaseUrl)) {
    return `${trimSlash(DEFAULT_PROXY_TARGET)}/v1`
  }

  const normalized = trimSlash(rawBaseUrl)

  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized.replace(/\/chat\/completions$/i, '')
  }

  if (/\/api\/ollama$/i.test(normalized)) {
    return normalized.replace(/\/api\/ollama$/i, '/v1')
  }

  if (/\/v1$/i.test(normalized)) {
    return normalized
  }

  return `${normalized}/v1`
}

function readConfig() {
  return {
    apiKey: process.env.GEMMA_EVAL_API_KEY?.trim() || process.env.VITE_GEMMA_API_KEY?.trim(),
    baseUrl: normalizeBaseUrl(
      process.env.GEMMA_EVAL_BASE_URL?.trim()
      || process.env.VITE_GEMMA_BASE_URL?.trim(),
    ),
    model:
      process.env.GEMMA_EVAL_CANDIDATE_MODEL?.trim()
      || process.env.VITE_GEMMA_APP_MODEL?.trim()
      || process.env.VITE_GEMMA_PRIMARY_MODEL?.trim()
      || 'gemma4:e2b',
  }
}

function extractJson(content) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fencedMatch ? fencedMatch[1].trim() : content.trim()
}

function readFlagValue(argv, flagName) {
  const flagIndex = argv.findIndex((item) => item === flagName)

  if (flagIndex >= 0) {
    return argv[flagIndex + 1]
  }

  const inlineFlag = argv.find((item) => item.startsWith(`${flagName}=`))
  return inlineFlag ? inlineFlag.slice(flagName.length + 1) : undefined
}

function readOptions() {
  const argv = process.argv.slice(2)

  return {
    caseId: readFlagValue(argv, '--case') ?? 'quiz-practice-phone-photo-flow',
    jsonPath: readFlagValue(argv, '--json'),
    markdownPath: readFlagValue(argv, '--md'),
    repeat: Number(readFlagValue(argv, '--repeat') ?? '3'),
  }
}

async function callChatJson({
  config,
  messages,
  stage,
  temperature = 0.1,
}) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  const startedAt = Date.now()
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages,
      model: config.model,
      response_format: {
        type: 'json_object',
      },
      stream: false,
      temperature,
    }),
    headers,
    method: 'POST',
  })
  const runtimeMs = Date.now() - startedAt

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`${stage} failed with ${response.status}${details ? `: ${details}` : ''}`)
  }

  const payload = await response.json()
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error(`${stage} did not return message content`)
  }

  return {
    raw: JSON.parse(extractJson(content)),
    runtimeMs,
  }
}

function scoreFinalResult(finalResult) {
  const renderedText = [
    finalResult.studentGuidance.startHere,
    finalResult.studentGuidance.suggestedScript,
    ...finalResult.studentGuidance.alternativeScripts,
    finalResult.parentGuidance.summary,
    ...finalResult.parentGuidance.coachNotes,
    finalResult.teacherGuidance.summary,
    ...finalResult.teacherGuidance.staffNotes,
    ...finalResult.relevantAccommodations.flatMap((item) => [
      item.name,
      item.plainLanguage,
      item.applicationReason,
      item.whyItMayMatter,
      ...item.implementationNotes,
    ]),
    ...finalResult.notObviouslyRelevant.flatMap((item) => [item.name, item.reason]),
    ...finalResult.boundaries,
  ].join(' ').toLowerCase()

  return {
    hasCalculatorBoundary:
      /calculator/.test(renderedText)
      && /(calculation test|calculation[- ]test|boundary|confirm|except)/.test(renderedText),
    hasExtendedTime: /extended time|extra time|additional time/.test(renderedText),
    hasNonblankGuidance:
      finalResult.studentGuidance.startHere.trim().length > 0
      && finalResult.studentGuidance.suggestedScript.trim().length > 0
      && finalResult.parentGuidance.summary.trim().length > 0
      && finalResult.teacherGuidance.summary.trim().length > 0,
    hasTimedCue: /30 minutes|timed|time limit|timer/.test(renderedText),
    noAnswerLeak:
      !/\b(78\.5|153\.86|480\.8125|22 units|area is|answer is)\b/.test(renderedText),
    relevantCount: finalResult.relevantAccommodations.length,
  }
}

async function runCompositeAttempt(config, evalCase, attemptIndex) {
  const diagnostics = {
    attemptIndex,
    runtimes: {},
    stage: 'starting',
  }

  try {
    diagnostics.stage = 'core'
    const core = await callChatJson({
      config,
      messages: [
        {
          content: buildCoreAnalysisSystemPrompt(),
          role: 'system',
        },
        {
          content: buildCoreAnalysisUserPrompt(evalCase.request),
          role: 'user',
        },
      ],
      stage: 'core',
    })
    diagnostics.runtimes.coreMs = core.runtimeMs
    const coreResult = parseCoreAnalysisResult(core.raw)

    diagnostics.stage = 'student'
    const student = await callChatJson({
      config,
      messages: [
        {
          content: buildStudentGuidanceSystemPrompt(),
          role: 'system',
        },
        {
          content: buildStudentGuidanceUserPrompt(evalCase.request, coreResult),
          role: 'user',
        },
      ],
      stage: 'student',
    })
    diagnostics.runtimes.studentMs = student.runtimeMs
    const studentGuidance = studentGuidanceSchema.parse(student.raw)

    diagnostics.stage = 'parent'
    const parent = await callChatJson({
      config,
      messages: [
        {
          content: buildParentGuidanceSystemPrompt(),
          role: 'system',
        },
        {
          content: buildParentGuidanceUserPrompt(evalCase.request, coreResult),
          role: 'user',
        },
      ],
      stage: 'parent',
    })
    diagnostics.runtimes.parentMs = parent.runtimeMs
    const parentGuidance = parentGuidanceSchema.parse(parent.raw)

    diagnostics.stage = 'teacher'
    const teacher = await callChatJson({
      config,
      messages: [
        {
          content: buildTeacherGuidanceSystemPrompt(),
          role: 'system',
        },
        {
          content: buildTeacherGuidanceUserPrompt(evalCase.request, coreResult),
          role: 'user',
        },
      ],
      stage: 'teacher',
    })
    diagnostics.runtimes.teacherMs = teacher.runtimeMs
    const teacherGuidance = teacherGuidanceSchema.parse(teacher.raw)

    diagnostics.stage = 'final'
    const finalResult = parseAnalysisResult({
      ...coreResult,
      parentGuidance,
      studentGuidance,
      teacherGuidance,
    })
    const score = scoreFinalResult(finalResult)
    const passed =
      score.hasNonblankGuidance
      && score.hasExtendedTime
      && score.hasTimedCue
      && score.noAnswerLeak
      && score.relevantCount > 0

    return {
      diagnostics,
      finalResult,
      passed,
      score,
      status: 'passed',
    }
  } catch (error) {
    return {
      diagnostics,
      error: error instanceof Error ? error.message : String(error),
      passed: false,
      status: 'failed',
    }
  }
}

function summarizeResults(results) {
  const passed = results.filter((item) => item.passed).length
  const failures = results.filter((item) => !item.passed)

  return {
    attempts: results.length,
    blank_or_invalid_failures: failures.length,
    pass_rate: results.length > 0 ? passed / results.length : 0,
    passed,
  }
}

function buildMarkdownReport(report) {
  return [
    `# Analysis Composite Eval: ${report.case.id}`,
    '',
    `- Model: ${report.model}`,
    `- Base URL: ${report.baseUrl}`,
    `- Attempts: ${report.summary.attempts}`,
    `- Passed: ${report.summary.passed}`,
    `- Pass rate: ${report.summary.pass_rate}`,
    '',
    '## Attempts',
    ...report.results.flatMap((result) => [
      '',
      `### Attempt ${result.diagnostics.attemptIndex}`,
      `- Status: ${result.status}`,
      `- Passed: ${result.passed}`,
      `- Stage: ${result.diagnostics.stage}`,
      result.error ? `- Error: ${result.error}` : '',
      result.score ? `- Score: ${JSON.stringify(result.score)}` : '',
      result.diagnostics.runtimes
        ? `- Runtimes: ${JSON.stringify(result.diagnostics.runtimes)}`
        : '',
    ].filter(Boolean)),
  ].join('\n')
}

async function writeReport(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

async function main() {
  const options = readOptions()
  const config = readConfig()
  const evalCase = evalCases.find((item) => item.id === options.caseId)

  if (!evalCase) {
    throw new Error(`Unknown eval case: ${options.caseId}`)
  }

  console.log(`Running ${options.repeat} composite analysis eval attempt(s)`)
  console.log(`Case: ${evalCase.id}`)
  console.log(`Model: ${config.model}`)
  console.log(`Base URL: ${config.baseUrl}`)

  const results = []

  for (let index = 0; index < options.repeat; index += 1) {
    const attempt = await runCompositeAttempt(config, evalCase, index + 1)
    results.push(attempt)
    console.log(
      `[${index + 1}/${options.repeat}] ${attempt.passed ? 'PASS' : 'FAIL'} stage=${attempt.diagnostics.stage}${attempt.error ? ` error=${attempt.error}` : ''}`,
    )
  }

  const report = {
    baseUrl: config.baseUrl,
    case: {
      id: evalCase.id,
      label: evalCase.label,
    },
    model: config.model,
    results,
    summary: summarizeResults(results),
  }

  console.log(`Summary: ${report.summary.passed}/${report.summary.attempts} passed (${report.summary.pass_rate})`)

  if (options.jsonPath) {
    await writeReport(options.jsonPath, JSON.stringify(report, null, 2))
  }

  if (options.markdownPath) {
    await writeReport(options.markdownPath, buildMarkdownReport(report))
  }

  if (report.summary.passed !== report.summary.attempts) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
