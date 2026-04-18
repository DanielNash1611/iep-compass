import { z } from 'zod'

import type { ImageEvalConfig } from './config.ts'
import { callOpenAiCompatibleJson } from './openaiCompatible.ts'
import type {
  ImageEvalCaseResult,
  JudgeMode,
  JudgeScoreResult,
  LoadedImageEvalCase,
} from './types.ts'

const accommodationFailureTags = [
  'ocr_failure',
  'missed_accommodation',
  'hallucinated_accommodation',
  'wrong_normalization',
  'lost_condition',
  'overconfident_on_unclear_text',
  'bad_document_type_detection',
] as const

const assignmentFailureTags = [
  'ocr_failure',
  'wrong_assignment_type',
  'missed_rubric_factor',
  'missed_deadline',
  'hallucinated_requirement',
  'missed_accommodation_relevant_signal',
  'failed_to_flag_incomplete_image',
] as const

const accommodationJudgeSchema = z.object({
  dimensions: z.object({
    condition_handling: z.number().int().min(1).max(5),
    extraction_fidelity: z.number().int().min(1).max(5),
    groundedness: z.number().int().min(1).max(5),
    hallucination_control: z.number().int().min(1).max(5),
    normalization_quality: z.number().int().min(1).max(5),
  }).strict(),
  issues: z.array(z.string()),
  pass: z.boolean(),
  strengths: z.array(z.string()),
  suggested_failure_tags: z.array(z.enum(accommodationFailureTags)),
  summary: z.string(),
}).strict()

const assignmentJudgeSchema = z.object({
  dimensions: z.object({
    groundedness: z.number().int().min(1).max(5),
    instruction_understanding: z.number().int().min(1).max(5),
    rubric_understanding: z.number().int().min(1).max(5),
    task_relevance_extraction: z.number().int().min(1).max(5),
    uncertainty_handling: z.number().int().min(1).max(5),
  }).strict(),
  issues: z.array(z.string()),
  pass: z.boolean(),
  strengths: z.array(z.string()),
  suggested_failure_tags: z.array(z.enum(assignmentFailureTags)),
  summary: z.string(),
}).strict()

function buildJudgePrompt(evalCase: LoadedImageEvalCase, caseResult: ImageEvalCaseResult) {
  const candidateLabel =
    evalCase.suite === 'accommodation_upload'
      ? 'Candidate accommodation text output:'
      : 'Candidate structured output:'

  return [
    `Suite: ${evalCase.suite}`,
    `Case id: ${evalCase.id}`,
    `Case label: ${evalCase.label}`,
    '',
    'Expected outcome:',
    JSON.stringify(evalCase.expected, null, 2),
    '',
    candidateLabel,
    JSON.stringify(caseResult.output ?? null, null, 2),
    '',
    'Deterministic checks:',
    JSON.stringify(caseResult.deterministic, null, 2),
    '',
    'Field checks:',
    JSON.stringify(caseResult.field, null, 2),
    '',
    'Existing failure tags:',
    JSON.stringify(caseResult.failure_tags, null, 2),
    '',
    'Score the output strictly against the visible-image extraction task only.',
    'Do not grade downstream accommodation reasoning.',
    'Return JSON only.',
  ].join('\n')
}

function mapJudgeResult(rawJudgeResult: unknown, mode: JudgeMode): JudgeScoreResult {
  if (
    !rawJudgeResult
    || typeof rawJudgeResult !== 'object'
    || Array.isArray(rawJudgeResult)
    || !('dimensions' in rawJudgeResult)
  ) {
    throw new Error('Judge result was not a valid object.')
  }

  return {
    dimensions: (rawJudgeResult as { dimensions: Record<string, number> }).dimensions,
    issues: Array.isArray((rawJudgeResult as { issues?: unknown }).issues)
      ? ((rawJudgeResult as { issues: string[] }).issues)
      : [],
    mode,
    pass:
      typeof (rawJudgeResult as { pass?: unknown }).pass === 'boolean'
        ? ((rawJudgeResult as { pass: boolean }).pass)
        : null,
    strengths: Array.isArray((rawJudgeResult as { strengths?: unknown }).strengths)
      ? ((rawJudgeResult as { strengths: string[] }).strengths)
      : [],
    suggested_failure_tags: Array.isArray(
      (rawJudgeResult as { suggested_failure_tags?: unknown }).suggested_failure_tags,
    )
      ? ((rawJudgeResult as { suggested_failure_tags: JudgeScoreResult['suggested_failure_tags'] }).suggested_failure_tags)
      : [],
    summary:
      typeof (rawJudgeResult as { summary?: unknown }).summary === 'string'
        ? ((rawJudgeResult as { summary: string }).summary)
        : 'Judge result unavailable.',
  }
}

export async function maybeJudgeImageEvalCase(options: {
  config: ImageEvalConfig
  evalCase: LoadedImageEvalCase
  result: ImageEvalCaseResult
}): Promise<JudgeScoreResult | null> {
  if (options.config.judgeMode === 'off') {
    return null
  }

  if (options.config.judgeMode === 'manual') {
    return {
      dimensions: {},
      issues: [],
      mode: 'manual',
      pass: null,
      suggested_failure_tags: [],
      strengths: [],
      summary: 'Manual judge mode selected. No automated rubric score was run.',
    }
  }

  if (!options.result.output) {
    return {
      dimensions: {},
      issues: ['No parsed output was available for judge scoring.'],
      mode: 'model',
      pass: false,
      suggested_failure_tags: [],
      strengths: [],
      summary: 'Judge skipped because the model output could not be parsed into the target schema.',
    }
  }

  const judgeModel = options.config.judgeModel || options.config.model
  const response = await callOpenAiCompatibleJson({
    apiKey: options.config.apiKey,
    baseUrl: options.config.baseUrl,
    messages: [
      {
        content: [
          'You are a strict evaluator for Gemma document image extraction.',
          'Prioritize grounded extraction, preservation of exceptions, and clear uncertainty handling.',
          'Do not reward polished but unsupported guesses.',
          'Return JSON only.',
        ].join('\n'),
        role: 'system',
      },
      {
        content: buildJudgePrompt(options.evalCase, options.result),
        role: 'user',
      },
    ],
    model: judgeModel,
    temperature: 0,
    timeoutMs: options.config.timeoutMs,
  })

  const parsedJson = JSON.parse(response.extractedJson)

  if (options.evalCase.suite === 'accommodation_upload') {
    return mapJudgeResult(
      accommodationJudgeSchema.parse(parsedJson),
      options.config.judgeMode,
    )
  }

  return mapJudgeResult(
    assignmentJudgeSchema.parse(parsedJson),
    options.config.judgeMode,
  )
}
