import { z } from 'zod'

import { parseAnalysisResult } from '../../src/lib/schema/analysisSchema.ts'
import { evalCases } from './cases.mjs'

const DEFAULT_CANDIDATE_MODEL = process.env.GEMMA_EVAL_CANDIDATE_MODEL?.trim()
  || process.env.VITE_GEMMA_PRIMARY_MODEL?.trim()
  || 'gemma4:e2b'
const EXPLICIT_JUDGE_MODEL = process.env.GEMMA_EVAL_JUDGE_MODEL?.trim()
  || process.env.VITE_GEMMA_FALLBACK_MODEL?.trim()
const SUGGESTED_JUDGE_MODEL = 'gemma3:27b'
const DEFAULT_PROXY_TARGET = process.env.GEMMA_PROXY_TARGET?.trim() || 'http://127.0.0.1:11434'

function buildGemmaSystemPrompt() {
  return [
    'You are IEP Compass, a structured analysis system for accommodation relevance mapping.',
    'Focus on the student-first core result and keep any parent or teacher notes secondary.',
    'Only reference accommodations explicitly found in the supplied IEP excerpt.',
    'Never invent a new accommodation, answer the assignment, or give legal advice.',
    'Keep the reasoning cautious, grounded, and source-based.',
    'Return valid JSON only.',
  ].join('\n')
}

function buildGemmaUserPrompt(request) {
  return [
    `Task title: ${request.taskTitle || 'Untitled task'}`,
    `Task context tags: ${
      request.contextTags.length > 0 ? request.contextTags.join(', ') : 'none supplied'
    }`,
    '',
    'Full IEP excerpt:',
    request.iepSource.text,
    '',
    'Task description:',
    request.taskSource.text,
    '',
    'Use only the excerpted accommodations and keep the output aligned with the schema.',
  ].join('\n')
}

const judgeResultSchema = z.object({
  absoluteApplicabilityClaim: z.boolean(),
  criticalFailures: z.array(z.string()),
  flags: z.object({
    feedbackVsGradingDistinguished: z.boolean(),
    measurementBoundaryAddressed: z.boolean(),
    staffConfirmationSuggested: z.boolean(),
  }),
  missedDisabilityConnections: z.array(z.string()),
  pass: z.boolean(),
  scores: z.object({
    cautionAboutApplicability: z.number().int().min(1).max(5),
    disabilitySpecificity: z.number().int().min(1).max(5),
    implementationBoundaries: z.number().int().min(1).max(5),
    measurementBoundaryNuance: z.number().int().min(1).max(5),
    overall: z.number().int().min(1).max(5),
  }),
  strengths: z.array(z.string()),
  summary: z.string(),
})

const SCORE_KEY_PATTERNS = {
  cautionAboutApplicability: [/caution/, /applic/],
  disabilitySpecificity: [/disab/, /specific|mechan|connection/],
  implementationBoundaries: [/implement|boundar|access/],
  measurementBoundaryNuance: [/measurement|target|rubric|boundary|nuance/],
  overall: [/overall|total|final/],
}

const FLAG_KEY_PATTERNS = {
  feedbackVsGradingDistinguished: [/feedback/, /grading|grade|penalt/],
  measurementBoundaryAddressed: [/measurement|target|rubric|boundary/],
  staffConfirmationSuggested: [/staff|confirm|team/],
}

function extractJson(content) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fencedMatch ? fencedMatch[1].trim() : content.trim()
}

function trimSlash(value) {
  return value.replace(/\/+$/, '')
}

function normalizeBaseUrl(rawBaseUrl) {
  if (!rawBaseUrl) {
    return `${trimSlash(DEFAULT_PROXY_TARGET)}/v1`
  }

  if (/^\/api\/ollama\/?$/i.test(rawBaseUrl)) {
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

function resolveBaseUrl() {
  const explicitEvalBase = process.env.GEMMA_EVAL_BASE_URL?.trim()

  if (explicitEvalBase) {
    return normalizeBaseUrl(explicitEvalBase)
  }

  const viteBase = process.env.VITE_GEMMA_BASE_URL?.trim()

  if (viteBase?.startsWith('http://') || viteBase?.startsWith('https://')) {
    return normalizeBaseUrl(viteBase)
  }

  return normalizeBaseUrl(viteBase)
}

function readConfig() {
  return {
    apiKey: process.env.GEMMA_EVAL_API_KEY?.trim() || process.env.VITE_GEMMA_API_KEY?.trim(),
    baseUrl: resolveBaseUrl(),
    candidateModel: DEFAULT_CANDIDATE_MODEL,
    judgeModel: EXPLICIT_JUDGE_MODEL,
    judgeModelSource: EXPLICIT_JUDGE_MODEL ? 'env' : 'discovery',
  }
}

function parseModelRank(modelId) {
  const normalized = modelId.toLowerCase()
  const versionMatch = normalized.match(/gemma(\d+)/)
  const sizeMatch = normalized.match(/(?:^|[:\-/])(\d+(?:\.\d+)?)b(?:$|[^a-z])/)

  return {
    size: sizeMatch ? Number(sizeMatch[1]) : 0,
    version: versionMatch ? Number(versionMatch[1]) : 0,
  }
}

function chooseLargestGemmaModel(modelIds, candidateModel) {
  const gemmaModels = modelIds
    .filter((modelId) => /gemma/i.test(modelId))
    .sort((left, right) => {
      const leftRank = parseModelRank(left)
      const rightRank = parseModelRank(right)

      if (leftRank.size !== rightRank.size) {
        return rightRank.size - leftRank.size
      }

      if (leftRank.version !== rightRank.version) {
        return rightRank.version - leftRank.version
      }

      return left.localeCompare(right)
    })

  if (gemmaModels.length === 0) {
    return undefined
  }

  return gemmaModels.find((modelId) => modelId !== candidateModel) || gemmaModels[0]
}

async function fetchAvailableModels(config) {
  const headers = {}

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  const response = await fetch(`${config.baseUrl}/models`, {
    headers,
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`Model discovery failed with ${response.status}`)
  }

  const payload = await response.json()
  const modelIds = payload.data
    ?.map((item) => item?.id)
    .filter((item) => typeof item === 'string') || []

  return modelIds
}

async function resolveJudgeModel(config) {
  if (config.judgeModel) {
    return config
  }

  try {
    const modelIds = await fetchAvailableModels(config)
    const discoveredJudgeModel = chooseLargestGemmaModel(modelIds, config.candidateModel)

    if (discoveredJudgeModel) {
      return {
        ...config,
        judgeModel: discoveredJudgeModel,
        judgeModelSource: 'discovered',
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return {
      ...config,
      judgeModel: SUGGESTED_JUDGE_MODEL,
      judgeModelSource: `fallback (${message})`,
    }
  }

  return {
    ...config,
    judgeModel: config.candidateModel,
    judgeModelSource: 'candidate-fallback',
  }
}

async function callChatJson({
  apiKey,
  baseUrl,
  messages,
  model,
  temperature = 0,
}) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages,
      model,
      response_format: {
        type: 'json_object',
      },
      stream: false,
      temperature,
    }),
    headers,
    method: 'POST',
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Model request failed with ${response.status}${details ? `: ${details}` : ''}`)
  }

  const payload = await response.json()
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Model response did not include message content')
  }

  return JSON.parse(extractJson(content))
}

async function generateCandidateAnalysis(config, request) {
  const rawResult = await callChatJson({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    messages: [
      {
        content: buildGemmaSystemPrompt(),
        role: 'system',
      },
      {
        content: buildGemmaUserPrompt(request),
        role: 'user',
      },
    ],
    model: config.candidateModel,
    temperature: 0.1,
  })

  return parseAnalysisResult(rawResult)
}

function buildJudgePrompt(evalCase, analysisResult) {
  const requiredJudgementFlags = evalCase.requiredJudgementFlags || []

  return [
    `Eval case: ${evalCase.label}`,
    '',
    'Scenario:',
    `- Task title: ${evalCase.request.taskTitle}`,
    '- Audience focus: student-first core analysis with optional parent and teacher sidecars',
    `- Context tags: ${evalCase.request.contextTags.join(', ') || 'none'}`,
    '',
    'IEP excerpt:',
    evalCase.request.iepSource.text,
    '',
    'Task description:',
    evalCase.request.taskSource.text,
    '',
    'Teacher concern:',
    evalCase.request.teacherConcern || 'None provided.',
    '',
    'Rubric focus:',
    ...evalCase.rubricFocus.map((item) => `- ${item}`),
    '',
    'Required concepts:',
    ...evalCase.requiredConcepts.map((item) => `- ${item}`),
    '',
    'Forbidden conclusions:',
    ...evalCase.forbiddenConclusions.map((item) => `- ${item}`),
    '',
    'Required judgement flags for this case:',
    ...(requiredJudgementFlags.length > 0
      ? requiredJudgementFlags.map((item) => `- ${item}`)
      : ['- none']),
    '',
    'Candidate output JSON:',
    JSON.stringify(analysisResult, null, 2),
    '',
    'Score the candidate on these dimensions from 1 to 5:',
    '- cautionAboutApplicability: Does it avoid fully claiming the accommodation definitely or automatically applies?',
    '- disabilitySpecificity: Does it explain the accommodation in terms of the named disability or processing need with a concrete mechanism?',
    '- implementationBoundaries: Does it keep the support about access rather than answer-giving or unfair advantage?',
    '- measurementBoundaryNuance: Does it explicitly address tension about what the task or rubric is measuring, rather than smoothing past ambiguity?',
    '- overall: Overall quality for this eval case.',
    '',
    'Set absoluteApplicabilityClaim to true if the candidate treats an accommodation as definite, automatic, or fully settled without enough caution.',
    'Set measurementBoundaryAddressed to true only if the candidate explicitly surfaces the tension between the accommodation condition and what the task, rubric, or teacher notes may be measuring.',
    'Set feedbackVsGradingDistinguished to true only if the candidate clearly separates feedback or revision from grade penalties when that distinction matters.',
    'Set staffConfirmationSuggested to true only if the candidate explicitly recommends confirmation with staff or the IEP team when the measurement boundary remains ambiguous.',
    'List criticalFailures only for serious rubric misses.',
    'List missedDisabilityConnections when the output leaves out a concrete disability-to-task explanation that the case called for.',
    'Return valid JSON only with this shape:',
    JSON.stringify({
      absoluteApplicabilityClaim: false,
      criticalFailures: ['string'],
      flags: {
        feedbackVsGradingDistinguished: true,
        measurementBoundaryAddressed: true,
        staffConfirmationSuggested: true,
      },
      missedDisabilityConnections: ['string'],
      pass: true,
      scores: {
        cautionAboutApplicability: 4,
        disabilitySpecificity: 4,
        implementationBoundaries: 4,
        measurementBoundaryNuance: 4,
        overall: 4,
      },
      strengths: ['string'],
      summary: 'string',
    }),
  ].join('\n')
}

async function judgeCase(config, evalCase, analysisResult) {
  const rawJudgement = await callChatJson({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    messages: [
      {
        content: [
          'You are a strict evaluator for IEP Compass output.',
          'Focus especially on three risks:',
          '1. Overclaiming that an accommodation completely or automatically applies.',
          '2. Smoothing over ambiguity about what the task or rubric is actually measuring.',
          '3. Giving generic explanations instead of disability-specific reasoning.',
          'Do not reward vague special-education language.',
          'Return JSON only.',
        ].join('\n'),
        role: 'system',
      },
      {
        content: buildJudgePrompt(evalCase, analysisResult),
        role: 'user',
      },
    ],
    model: config.judgeModel,
  })

  return judgeResultSchema.parse(normalizeJudgeResult(rawJudgement))
}

function normalizeScoreValue(value) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return value
}

function normalizeJudgeResult(rawJudgement) {
  if (!rawJudgement || typeof rawJudgement !== 'object' || Array.isArray(rawJudgement)) {
    return rawJudgement
  }

  const normalized = { ...rawJudgement }
  const rawFlags =
    normalized.flags && typeof normalized.flags === 'object' && !Array.isArray(normalized.flags)
      ? { ...normalized.flags }
      : {}
  const rawScores =
    normalized.scores && typeof normalized.scores === 'object' && !Array.isArray(normalized.scores)
      ? { ...normalized.scores }
      : {}

  const normalizedFlags = {}
  const normalizedScores = {}

  for (const [targetKey, patterns] of Object.entries(FLAG_KEY_PATTERNS)) {
    if (targetKey in rawFlags) {
      normalizedFlags[targetKey] = Boolean(rawFlags[targetKey])
      continue
    }

    const aliasKey = Object.keys({ ...normalized, ...rawFlags }).find((candidateKey) => {
      const lowered = candidateKey.toLowerCase()
      return patterns.every((pattern) => pattern.test(lowered))
    })

    if (aliasKey) {
      normalizedFlags[targetKey] = Boolean(rawFlags[aliasKey] ?? normalized[aliasKey])
    }
  }

  for (const [targetKey, patterns] of Object.entries(SCORE_KEY_PATTERNS)) {
    if (targetKey in rawScores) {
      normalizedScores[targetKey] = normalizeScoreValue(rawScores[targetKey])
      continue
    }

    const aliasKey = Object.keys(rawScores).find((candidateKey) => {
      const lowered = candidateKey.toLowerCase()
      return patterns.every((pattern) => pattern.test(lowered))
    })

    if (aliasKey) {
      normalizedScores[targetKey] = normalizeScoreValue(rawScores[aliasKey])
    }
  }

  normalized.scores = {
    ...rawScores,
    ...normalizedScores,
  }
  normalized.flags = {
    ...rawFlags,
    ...normalizedFlags,
  }

  return normalized
}

function computePass(judgement) {
  return (
    judgement.pass
    && !judgement.absoluteApplicabilityClaim
    && judgement.criticalFailures.length === 0
    && judgement.scores.cautionAboutApplicability >= 4
    && judgement.scores.disabilitySpecificity >= 4
    && judgement.scores.implementationBoundaries >= 4
    && judgement.scores.overall >= 4
  )
}

function satisfiesRequiredJudgementFlags(evalCase, judgement) {
  const requiredJudgementFlags = evalCase.requiredJudgementFlags || []

  if (requiredJudgementFlags.length === 0) {
    return true
  }

  return requiredJudgementFlags.every((flag) => judgement.flags[flag] === true)
}

function computeCasePass(evalCase, judgement) {
  return (
    computePass(judgement)
    && satisfiesRequiredJudgementFlags(evalCase, judgement)
    && (
      (evalCase.requiredJudgementFlags || []).includes('measurementBoundaryAddressed')
        ? judgement.scores.measurementBoundaryNuance >= 4
        : true
    )
  )
}

function formatList(items) {
  return items.length > 0 ? items.map((item) => `  - ${item}`).join('\n') : '  - none'
}

function printUsage() {
  console.log(`Usage:
  npm run evals:gemma
  npm run evals:gemma -- --case reading-assessment-boundary

Optional environment:
  GEMMA_EVAL_BASE_URL
  GEMMA_EVAL_API_KEY
  GEMMA_EVAL_CANDIDATE_MODEL
  GEMMA_EVAL_JUDGE_MODEL`)
}

function readSelectedCaseId(argv) {
  const caseFlagIndex = argv.findIndex((item) => item === '--case')

  if (caseFlagIndex >= 0) {
    return argv[caseFlagIndex + 1]
  }

  const inlineCaseFlag = argv.find((item) => item.startsWith('--case='))

  if (inlineCaseFlag) {
    return inlineCaseFlag.slice('--case='.length)
  }

  return undefined
}

async function main() {
  const argv = process.argv.slice(2)

  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage()
    return
  }

  const selectedCaseId = readSelectedCaseId(argv)
  const selectedCases = selectedCaseId
    ? evalCases.filter((item) => item.id === selectedCaseId)
    : evalCases

  if (selectedCases.length === 0) {
    throw new Error(
      selectedCaseId
        ? `Unknown eval case: ${selectedCaseId}`
        : 'No eval cases selected',
    )
  }

  const config = await resolveJudgeModel(readConfig())

  console.log(`Running ${selectedCases.length} eval case(s)`)
  console.log(`Candidate model: ${config.candidateModel}`)
  console.log(`Judge model: ${config.judgeModel} [${config.judgeModelSource}]`)
  console.log(`Base URL: ${config.baseUrl}`)

  const results = []

  for (const evalCase of selectedCases) {
    console.log(`\n[${results.length + 1}/${selectedCases.length}] ${evalCase.id}`)

    try {
      const analysisResult = await generateCandidateAnalysis(config, evalCase.request)
      const judgement = await judgeCase(config, evalCase, analysisResult)
      const passed = computeCasePass(evalCase, judgement)

      results.push({
        id: evalCase.id,
        judgement,
        passed,
      })

      console.log(`${passed ? 'PASS' : 'FAIL'} - ${evalCase.label}`)
      console.log(`  Summary: ${judgement.summary}`)
      console.log(
        `  Scores: caution=${judgement.scores.cautionAboutApplicability}, disability=${judgement.scores.disabilitySpecificity}, boundaries=${judgement.scores.implementationBoundaries}, measurement=${judgement.scores.measurementBoundaryNuance}, overall=${judgement.scores.overall}`,
      )
      console.log(`  Absolute applicability claim: ${judgement.absoluteApplicabilityClaim ? 'yes' : 'no'}`)
      console.log(
        `  Flags: measurementBoundary=${judgement.flags.measurementBoundaryAddressed ? 'yes' : 'no'}, feedbackVsGrading=${judgement.flags.feedbackVsGradingDistinguished ? 'yes' : 'no'}, staffConfirmation=${judgement.flags.staffConfirmationSuggested ? 'yes' : 'no'}`,
      )
      console.log('  Strengths:')
      console.log(formatList(judgement.strengths))
      console.log('  Critical failures:')
      console.log(formatList(judgement.criticalFailures))
      console.log('  Missed disability connections:')
      console.log(formatList(judgement.missedDisabilityConnections))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      results.push({
        error: message,
        id: evalCase.id,
        passed: false,
      })

      console.log(`FAIL - ${evalCase.label}`)
      console.log(`  Error: ${message}`)
    }
  }

  const passedCount = results.filter((item) => item.passed).length

  console.log(`\nFinished: ${passedCount}/${results.length} passed`)

  if (passedCount !== results.length) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Eval runner failed: ${message}`)
  process.exitCode = 1
})
