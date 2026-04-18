import { execFile as execFileCallback } from 'node:child_process'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { createGemmaVisionEvalAdapter } from './adapter.ts'
import { loadImageEvalCases } from './caseLoader.ts'
import { readImageEvalConfig, type ImageEvalConfig } from './config.ts'
import { classifyImageEvalFailure, isRetryableRuntimeFailure } from './failureMode.ts'
import { maybeJudgeImageEvalCase } from './judge.ts'
import {
  renderMarkdownReport,
  renderSuiteSummary,
  summarizeImageEvalCases,
  writeReportFile,
} from './reporting.ts'
import {
  applyJudgeResult,
  scoreAccommodationEvalCase,
  scoreAssignmentEvalCase,
} from './scoring.ts'
import type {
  ImageEvalCaseResult,
  ImageEvalRunReport,
  ImageEvalSuiteId,
  JudgeMode,
  LoadedImageEvalCase,
} from './types.ts'

const execFile = promisify(execFileCallback)
const SCRIPT_PATH = fileURLToPath(import.meta.url)

interface CliOptions {
  caseId?: string
  caseResultOutputPath?: string
  freshProcessPerCase: boolean
  help: boolean
  jsonOutputPath?: string
  judgeMode?: JudgeMode
  judgeModel?: string
  markdownOutputPath?: string
  model?: string
  quiet: boolean
  runtimeRetryCount: number
  suite?: ImageEvalSuiteId
}

function printUsage() {
  console.log(`Usage:
  npm run evals:gemma:image
  npm run evals:gemma:image -- --suite accommodation_upload
  npm run evals:gemma:image -- --suite assignment_upload
  npm run evals:gemma:image -- --case essay_rubric_spelling
  npm run evals:gemma:image -- --judge model --json tmp/image-evals.json --md tmp/image-evals.md

Flags:
  --suite <accommodation_upload|assignment_upload>
  --case <case_id>
  --judge <off|model|manual>
  --judge-model <model_id>
  --model <model_id>
  --json <path>
  --md <path>
  --fresh-process-per-case
  --runtime-retries <count>

Environment:
  GEMMA_IMAGE_EVAL_BASE_URL
  GEMMA_IMAGE_EVAL_API_KEY
  GEMMA_IMAGE_EVAL_MODEL
  GEMMA_IMAGE_EVAL_JUDGE_MODE
  GEMMA_IMAGE_EVAL_JUDGE_MODEL`)
}

function readFlagValue(argv: string[], flag: string) {
  const directIndex = argv.findIndex((item) => item === flag)

  if (directIndex >= 0) {
    return argv[directIndex + 1]
  }

  const inlineFlag = argv.find((item) => item.startsWith(`${flag}=`))
  return inlineFlag ? inlineFlag.slice(flag.length + 1) : undefined
}

function readCliOptions(argv: string[]): CliOptions {
  const suite = readFlagValue(argv, '--suite')
  const judgeMode = readFlagValue(argv, '--judge')
  const runtimeRetryCount = Number(readFlagValue(argv, '--runtime-retries') || '0')

  return {
    caseId: readFlagValue(argv, '--case'),
    caseResultOutputPath: readFlagValue(argv, '--case-result-json'),
    freshProcessPerCase:
      argv.includes('--fresh-process-per-case')
      && !argv.includes('--no-fresh-process-per-case'),
    help: argv.includes('--help') || argv.includes('-h'),
    jsonOutputPath: readFlagValue(argv, '--json'),
    judgeMode:
      judgeMode === 'off' || judgeMode === 'model' || judgeMode === 'manual'
        ? judgeMode
        : undefined,
    judgeModel: readFlagValue(argv, '--judge-model'),
    markdownOutputPath: readFlagValue(argv, '--md'),
    model: readFlagValue(argv, '--model'),
    quiet: argv.includes('--quiet'),
    runtimeRetryCount: Number.isFinite(runtimeRetryCount) ? Math.max(0, runtimeRetryCount) : 0,
    suite:
      suite === 'accommodation_upload' || suite === 'assignment_upload'
        ? suite
        : undefined,
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function printCaseResult(result: ImageEvalCaseResult) {
  console.log(`${result.status.toUpperCase()} - ${result.case.label}`)
  console.log(`  Failure tags: ${result.failure_tags.join(', ') || 'none'}`)
  console.log(
    `  Scores: deterministic=${result.deterministic.score.toFixed(3)}, field=${result.field.score.toFixed(3)}, uncertainty=${result.metrics.uncertainty_handling_score.toFixed(3)}`,
  )

  if (result.metrics.condition_preservation_score !== null) {
    console.log(
      `  Condition preservation: ${result.metrics.condition_preservation_score.toFixed(3)}`,
    )
  }

  if (result.metrics.incomplete_image_handling_score !== null) {
    console.log(
      `  Incomplete-image handling: ${result.metrics.incomplete_image_handling_score.toFixed(3)}`,
    )
  }

  if (result.judge) {
    console.log(`  Judge: ${result.judge.summary}`)
  }

  if (result.diagnostics) {
    console.log(
      `  Diagnostics: pipeline=${result.diagnostics.pipeline || 'unknown'}, transport=${result.diagnostics.transport || 'unknown'}, path=${result.diagnostics.requestPath || 'unknown'}, failurePoint=${result.diagnostics.failurePoint || 'none'}`,
    )

    if (result.diagnostics.runnerIsolation) {
      console.log(`  Runner isolation: ${result.diagnostics.runnerIsolation}`)
    }

    if (result.diagnostics.runnerAttempts?.length) {
      console.log(
        `  Runner attempts: ${result.diagnostics.runnerAttempts.map((attempt) => `${attempt.attemptNumber}:${attempt.status}${attempt.failureMode && attempt.failureMode !== 'none' ? `/${attempt.failureMode}` : ''}`).join(', ')}`,
      )
    }

    if (result.diagnostics.originalAsset) {
      console.log(
        `  Original image: mime=${result.diagnostics.originalAsset.mimeType}, format=${result.diagnostics.originalAsset.format}, size=${result.diagnostics.originalAsset.bytes}B, dimensions=${result.diagnostics.originalAsset.dimensions.width}x${result.diagnostics.originalAsset.dimensions.height}`,
      )
    }

    if (result.diagnostics.finalAsset) {
      console.log(
        `  Sent image: mime=${result.diagnostics.finalAsset.mimeType}, format=${result.diagnostics.finalAsset.format}, size=${result.diagnostics.finalAsset.bytes}B, dimensions=${result.diagnostics.finalAsset.dimensions.width}x${result.diagnostics.finalAsset.dimensions.height}`,
      )
    }

    if (result.diagnostics.normalizedAsset) {
      console.log(
        `  Normalized image: mime=${result.diagnostics.normalizedAsset.mimeType}, format=${result.diagnostics.normalizedAsset.format}, size=${result.diagnostics.normalizedAsset.bytes}B, dimensions=${result.diagnostics.normalizedAsset.dimensions.width}x${result.diagnostics.normalizedAsset.dimensions.height}`,
      )
    }

    if (typeof result.diagnostics.photoMode === 'boolean') {
      console.log(`  Photo mode: ${result.diagnostics.photoMode ? 'yes' : 'no'}`)
    }

    if (typeof result.diagnostics.focusedRecoveryTriggered === 'boolean') {
      console.log(
        `  Focused recovery: ${result.diagnostics.focusedRecoveryTriggered ? 'triggered' : 'not triggered'}`,
      )
    }

    if (typeof result.diagnostics.preprocessRuntimeMs === 'number') {
      console.log(`  Preprocess runtime: ${result.diagnostics.preprocessRuntimeMs}ms`)
    }

    if (typeof result.diagnostics.extractionRuntimeMs === 'number') {
      console.log(`  Extraction runtime: ${result.diagnostics.extractionRuntimeMs}ms`)
    }

    if (typeof result.diagnostics.structuringRuntimeMs === 'number') {
      console.log(`  Structuring runtime: ${result.diagnostics.structuringRuntimeMs}ms`)
    }

    if (typeof result.diagnostics.firstChunkMs === 'number') {
      console.log(`  First chunk: ${result.diagnostics.firstChunkMs}ms`)
    }

    if (typeof result.diagnostics.firstContentMs === 'number') {
      console.log(`  First content: ${result.diagnostics.firstContentMs}ms`)
    }

    if (typeof result.diagnostics.runtimeMs === 'number') {
      console.log(`  Runtime: ${result.diagnostics.runtimeMs}ms`)
    }

    if (result.diagnostics.attempts?.length) {
      console.log(
        `  Pass attempts: ${result.diagnostics.attempts.map((attempt) => `${attempt.passLabel}:${attempt.error ? `failed/${attempt.failureMode || 'other'}` : `ok${typeof attempt.runtimeMs === 'number' ? `/${attempt.runtimeMs}ms` : ''}`}`).join(', ')}`,
      )
    }

    if (result.diagnostics.selectedPassLabel) {
      console.log(`  Selected pass: ${result.diagnostics.selectedPassLabel}`)
    }

    if (result.diagnostics.draftHealth) {
      console.log(
        `  Draft health: headings=${result.diagnostics.draftHealth.sectionHeadingCount}, signals=${result.diagnostics.draftHealth.signalLineCount}, headingHeavy=${result.diagnostics.draftHealth.isHeadingHeavy ? 'yes' : 'no'}, boilerplate=${result.diagnostics.draftHealth.boilerplateLineCount}`,
      )
    }
  }

  if (result.parse_error) {
    console.log(`  Parse error: ${result.parse_error}`)
  }
}

function createSkippedResult(evalCase: LoadedImageEvalCase, model: string) {
  return {
    case: evalCase,
    deterministic: {
      checks: [],
      passed: false,
      score: 0,
    },
    failure_tags: [],
    field: {
      checks: [],
      passed: false,
      score: 0,
    },
    judge: null,
    metrics: {
      condition_preservation_score: null,
      field_score: 0,
      hallucination_flagged: 0,
      incomplete_image_handling_score: null,
      uncertainty_handling_score: 0,
    },
    model,
    parse_error: `Missing image fixture at ${evalCase.resolvedImagePath}`,
    status: 'skipped',
  } satisfies ImageEvalCaseResult
}

async function executeCase(
  evalCase: LoadedImageEvalCase,
  config: ImageEvalConfig,
) {
  if (!(await fileExists(evalCase.resolvedImagePath))) {
    return createSkippedResult(evalCase, config.model)
  }

  const adapter = createGemmaVisionEvalAdapter(config)

  try {
    const modelResult =
      evalCase.suite === 'accommodation_upload'
        ? await adapter.interpretAccommodationUpload(evalCase.resolvedImagePath)
        : await adapter.interpretAssignmentUpload(evalCase.resolvedImagePath)

    const scoredResult =
      evalCase.suite === 'accommodation_upload'
        ? scoreAccommodationEvalCase({
            evalCase,
            model: config.model,
            modelResult,
          })
        : scoreAssignmentEvalCase({
            evalCase,
            model: config.model,
            modelResult,
          })

    const judgeResult = await maybeJudgeImageEvalCase({
      config,
      evalCase,
      result: scoredResult,
    }).catch((error) => ({
      dimensions: {},
      issues: [error instanceof Error ? error.message : String(error)],
      mode: config.judgeMode,
      pass: false,
      suggested_failure_tags: [],
      strengths: [],
      summary: 'Judge call failed.',
    }))

    return applyJudgeResult(scoredResult, judgeResult)
  } catch (error) {
    return {
      case: evalCase,
      deterministic: {
        checks: [],
        passed: false,
        score: 0,
      },
      failure_tags: ['ocr_failure'],
      field: {
        checks: [],
        passed: false,
        score: 0,
      },
      judge: null,
      metrics: {
        condition_preservation_score: null,
        field_score: 0,
        hallucination_flagged: 0,
        incomplete_image_handling_score: null,
        uncertainty_handling_score: 0,
      },
      model: config.model,
      parse_error: error instanceof Error ? error.message : String(error),
      status: 'failed',
    } satisfies ImageEvalCaseResult
  }
}

function withRunnerDiagnostics(
  result: ImageEvalCaseResult,
  runnerIsolation: 'fresh_process' | 'same_process',
  runnerAttempts: NonNullable<ImageEvalCaseResult['diagnostics']>['runnerAttempts'] = [],
) {
  return {
    ...result,
    diagnostics: {
      ...(result.diagnostics || {}),
      runnerAttempts,
      runnerIsolation,
    },
  } satisfies ImageEvalCaseResult
}

async function runCaseInFreshProcess(
  evalCase: LoadedImageEvalCase,
  config: ImageEvalConfig,
  options: CliOptions,
) {
  const runnerAttempts: NonNullable<ImageEvalCaseResult['diagnostics']>['runnerAttempts'] = []
  const maxAttempts = options.runtimeRetryCount + 1

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    const startedAt = Date.now()
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'iep-compass-image-eval-case-'))
    const caseResultPath = path.join(tempDirectory, 'case-result.json')
    let childErrorDetails = ''

    try {
      const childArgs = [
        ...process.execArgv,
        SCRIPT_PATH,
        '--suite',
        evalCase.suite,
        '--case',
        evalCase.id,
        '--model',
        config.model,
        '--judge',
        config.judgeMode,
        '--case-result-json',
        caseResultPath,
        '--quiet',
      ]

      if (config.judgeModel) {
        childArgs.push('--judge-model', config.judgeModel)
      }

      await execFile(process.execPath, childArgs, {
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      }).catch((error) => {
        const stdout = 'stdout' in (error as Record<string, unknown>)
          ? String((error as { stdout?: string }).stdout || '')
          : ''
        const stderr = 'stderr' in (error as Record<string, unknown>)
          ? String((error as { stderr?: string }).stderr || '')
          : ''
        childErrorDetails = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n')
      })

      const result = JSON.parse(await readFile(caseResultPath, 'utf8')) as ImageEvalCaseResult
      const failureMode = classifyImageEvalFailure(result.parse_error)

      runnerAttempts.push({
        attemptNumber,
        durationMs: Date.now() - startedAt,
        failureMode,
        parseError: result.parse_error,
        status: result.status,
      })

      await rm(tempDirectory, { force: true, recursive: true })

      if (
        attemptNumber < maxAttempts
        && result.status === 'failed'
        && isRetryableRuntimeFailure(result.parse_error)
      ) {
        if (!options.quiet) {
          console.log(
            `  Retrying fresh process after ${failureMode} failure: ${result.parse_error}`,
          )
        }
        continue
      }

      return withRunnerDiagnostics(result, 'fresh_process', runnerAttempts)
    } catch (error) {
      await rm(tempDirectory, { force: true, recursive: true })
      throw new Error(
        [
          `Fresh-process case execution failed for ${evalCase.id}.`,
          error instanceof Error ? error.message : String(error),
          childErrorDetails,
        ]
          .filter(Boolean)
          .join(' '),
      )
    }
  }

  throw new Error(`No fresh-process result returned for ${evalCase.id}.`)
}

async function runSelectedCases(
  selectedCases: LoadedImageEvalCase[],
  config: ImageEvalConfig,
  options: CliOptions,
) {
  const caseResults: ImageEvalCaseResult[] = []

  for (const evalCase of selectedCases) {
    if (!options.quiet) {
      console.log(`\n[${caseResults.length + 1}/${selectedCases.length}] ${evalCase.id}`)
    }

    const result = options.freshProcessPerCase
      ? await runCaseInFreshProcess(evalCase, config, options)
      : withRunnerDiagnostics(await executeCase(evalCase, config), 'same_process')

    caseResults.push(result)

    if (!options.quiet) {
      if (result.status === 'skipped') {
        console.log(`SKIPPED - ${result.case.label}`)
        console.log(`  Missing image fixture: ${evalCase.resolvedImagePath}`)
      } else {
        printCaseResult(result)
      }
    }
  }

  return caseResults
}

async function main() {
  const options = readCliOptions(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const config = readImageEvalConfig({
    judgeMode: options.judgeMode,
    judgeModel: options.judgeModel,
    model: options.model,
  })
  const loadedCases = await loadImageEvalCases(options.suite)
  const selectedCases = options.caseId
    ? loadedCases.filter((item) => item.id === options.caseId)
    : loadedCases

  if (selectedCases.length === 0) {
    throw new Error(
      options.caseId ? `Unknown image eval case: ${options.caseId}` : 'No image eval cases selected.',
    )
  }

  if (options.caseResultOutputPath && selectedCases.length !== 1) {
    throw new Error('--case-result-json requires exactly one selected case.')
  }

  if (!options.quiet) {
    console.log(`Running ${selectedCases.length} image eval case(s)`)
    console.log(`Vision model: ${config.model}`)
    console.log(`Judge mode: ${config.judgeMode}`)
    console.log(`Judge model: ${config.judgeModel || 'n/a'}`)
    console.log(`Base URL: ${config.baseUrl}`)
  }

  const caseResults = await runSelectedCases(selectedCases, config, options)

  if (options.caseResultOutputPath) {
    await writeReportFile(options.caseResultOutputPath, JSON.stringify(caseResults[0], null, 2))

    if (caseResults[0]?.status === 'failed') {
      process.exitCode = 1
    }

    return
  }

  const suiteIds = Array.from(new Set(caseResults.map((item) => item.case.suite)))
  const suiteReports = suiteIds.map((suiteId) =>
    summarizeImageEvalCases(
      suiteId,
      caseResults.filter((item) => item.case.suite === suiteId),
    ),
  )

  if (!options.quiet) {
    console.log('\nSummary')
    suiteReports.forEach((suiteReport) => {
      console.log(renderSuiteSummary(suiteReport))
    })
  }

  const report: ImageEvalRunReport = {
    generated_at: new Date().toISOString(),
    judge_mode: config.judgeMode,
    judge_model: config.judgeModel,
    model: config.model,
    suites: suiteReports,
  }

  if (options.jsonOutputPath) {
    await writeReportFile(options.jsonOutputPath, JSON.stringify(report, null, 2))

    if (!options.quiet) {
      console.log(`\nWrote JSON report to ${options.jsonOutputPath}`)
    }
  }

  if (options.markdownOutputPath) {
    await writeReportFile(options.markdownOutputPath, renderMarkdownReport(report))

    if (!options.quiet) {
      console.log(`Wrote Markdown report to ${options.markdownOutputPath}`)
    }
  }

  if (suiteReports.some((suiteReport) => suiteReport.summary.failed_cases > 0)) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Image eval runner failed: ${message}`)
  process.exitCode = 1
})
