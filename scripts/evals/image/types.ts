import type {
  AssignmentUploadInterpretation,
} from '../../../src/lib/schema/imageInterpretationSchema.ts'
import type { AccommodationDraftHealth } from '../../../src/lib/text/accommodationImagePrep.ts'
import type {
  AccommodationUploadEvalCase,
  AssignmentUploadEvalCase,
  ImageEvalCase,
} from './caseSchemas.ts'
import type { ImageEvalFailureMode } from './failureMode.ts'

export type ImageEvalSuiteId = 'accommodation_upload' | 'assignment_upload'
export type ImageEvalStatus = 'passed' | 'failed' | 'skipped'
export type JudgeMode = 'off' | 'model' | 'manual'

export type AccommodationFailureTag =
  | 'ocr_failure'
  | 'missed_accommodation'
  | 'hallucinated_accommodation'
  | 'wrong_normalization'
  | 'lost_condition'
  | 'overconfident_on_unclear_text'
  | 'bad_document_type_detection'

export type AssignmentFailureTag =
  | 'ocr_failure'
  | 'wrong_assignment_type'
  | 'missed_rubric_factor'
  | 'missed_deadline'
  | 'missed_follow_up_question'
  | 'hallucinated_requirement'
  | 'missed_accommodation_relevant_signal'
  | 'failed_to_flag_incomplete_image'

export type ImageEvalFailureTag = AccommodationFailureTag | AssignmentFailureTag

export interface LoadedAccommodationUploadEvalCase
  extends AccommodationUploadEvalCase {
  caseFilePath: string
  resolvedImagePath: string
}

export interface LoadedAssignmentUploadEvalCase
  extends AssignmentUploadEvalCase {
  caseFilePath: string
  resolvedImagePath: string
}

export type LoadedImageEvalCase =
  | LoadedAccommodationUploadEvalCase
  | LoadedAssignmentUploadEvalCase

export interface EvalCheckResult {
  details?: string
  key: string
  passed: boolean
}

export interface EvalScoreBlock {
  checks: EvalCheckResult[]
  passed: boolean
  score: number
}

export interface JudgeScoreResult {
  dimensions: Record<string, number>
  issues: string[]
  mode: JudgeMode
  pass: boolean | null
  summary: string
  suggested_failure_tags: ImageEvalFailureTag[]
  strengths: string[]
}

export interface ModelInterpretationFailure {
  diagnostics?: ImageEvalDiagnostics
  parseError?: string
  rawContent?: string
  rawJson?: unknown
}

export interface ModelInterpretationSuccess<TOutput> {
  diagnostics?: ImageEvalDiagnostics
  output: TOutput
  rawContent: string
  rawJson: unknown
}

export type ModelInterpretationResult<TOutput> =
  | ModelInterpretationFailure
  | ModelInterpretationSuccess<TOutput>

export interface BaseCaseMetrics {
  field_score: number
  hallucination_flagged: number
  uncertainty_handling_score: number
}

export interface AccommodationCaseMetrics extends BaseCaseMetrics {
  condition_preservation_score: number | null
  incomplete_image_handling_score: null
}

export interface AssignmentCaseMetrics extends BaseCaseMetrics {
  condition_preservation_score: null
  incomplete_image_handling_score: number | null
}

export type CaseMetrics = AccommodationCaseMetrics | AssignmentCaseMetrics

export interface BaseImageEvalCaseResult<TCase extends ImageEvalCase> {
  case: TCase
  deterministic: EvalScoreBlock
  diagnostics?: ImageEvalDiagnostics
  failure_tags: ImageEvalFailureTag[]
  field: EvalScoreBlock
  judge: JudgeScoreResult | null
  metrics: CaseMetrics
  model: string
  parse_error?: string
  raw_content?: string
  raw_json?: unknown
  status: ImageEvalStatus
}

export interface AccommodationImageEvalCaseResult
  extends BaseImageEvalCaseResult<LoadedAccommodationUploadEvalCase> {
  output?: string
}

export interface AssignmentImageEvalCaseResult
  extends BaseImageEvalCaseResult<LoadedAssignmentUploadEvalCase> {
  output?: AssignmentUploadInterpretation
}

export type ImageEvalCaseResult =
  | AccommodationImageEvalCaseResult
  | AssignmentImageEvalCaseResult

export interface ImageEvalRunSummary {
  average_field_score: number
  average_judge_dimensions: Record<string, number>
  average_judge_overall: number | null
  average_uncertainty_handling_score: number
  case_ids_failed: string[]
  condition_preservation_score: number | null
  executed_cases: number
  failed_cases: number
  failure_tag_counts: Record<string, number>
  hallucination_rate: number
  incomplete_image_handling_score: number | null
  pass_rate: number
  passed_cases: number
  skipped_cases: number
  total_cases: number
}

export interface ImageEvalSuiteReport {
  cases: ImageEvalCaseResult[]
  summary: ImageEvalRunSummary
  suite: ImageEvalSuiteId
}

export interface ImageEvalRunReport {
  generated_at: string
  model: string
  judge_mode: JudgeMode
  judge_model?: string
  suites: ImageEvalSuiteReport[]
}

export interface ImageAssetDetails {
  bytes: number
  dimensions: {
    height: number
    width: number
  }
  format: string
  mimeType: string
  path: string
}

export interface ImageEvalAttemptDiagnostics {
  error?: string
  failureMode?: ImageEvalFailureMode
  firstChunkMs?: number
  firstContentMs?: number
  outputPreview?: string
  passLabel: string
  runtimeMs?: number
}

export interface ImageEvalRunnerAttemptDiagnostics {
  attemptNumber: number
  durationMs: number
  failureMode?: ImageEvalFailureMode
  parseError?: string
  status: ImageEvalStatus
}

export interface ImageEvalDiagnostics {
  attempts?: ImageEvalAttemptDiagnostics[]
  draftHealth?: AccommodationDraftHealth
  extractionPreview?: string
  extractionRuntimeMs?: number
  failurePoint?: string
  finalAsset?: ImageAssetDetails
  firstChunkMs?: number
  firstContentMs?: number
  focusedRecoveryTriggered?: boolean
  inactivityTimeoutMs?: number
  normalizedAsset?: ImageAssetDetails
  originalAsset?: ImageAssetDetails
  pipeline?: 'vision_extract_text' | 'vision_extract_then_structure' | 'direct_json'
  photoMode?: boolean
  preprocessRuntimeMs?: number
  requestPath?: string
  runnerAttempts?: ImageEvalRunnerAttemptDiagnostics[]
  runnerIsolation?: 'fresh_process' | 'same_process'
  runtimeMs?: number
  selectedPassLabel?: string
  structuringRuntimeMs?: number
  totalTimeoutMs?: number
  transport?: string
}
