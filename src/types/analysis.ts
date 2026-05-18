import type {
  AnalysisResult,
  TeacherConcernEvaluation,
} from '../lib/schema/analysisSchema'
import type {
  DocumentConfidenceFlags,
  DocumentKind,
  StructuredDocumentDraft,
  TaskReviewDraft,
} from '../lib/schema/ocrSchema'

export const taskContexts = [
  'timed',
  'quiz',
  'homework',
  'classwork',
  'lab',
  'writing',
  'reading',
] as const
export type TaskContext = (typeof taskContexts)[number]

export type AttachmentKind = 'image' | 'pdf' | 'text' | 'other'
export type AttachmentStatus =
  | 'applied_to_text'
  | 'text_ready'
  | 'interpret_ready'
  | 'interpret_running'
  | 'review_ready'
  | 'included'
  | 'reference_only'
  | 'failed'

export type AttachmentReadMethod =
  | 'gemma4_image'
  | 'gemma4_pdf_pages'
  | 'plain_text_file'

export type AttachmentInterpretationPhase =
  | 'checking_model'
  | 'downloading_model'
  | 'preparing_image'
  | 'preparing_pdf'
  | 'scanning_image'
  | 'scanning_pdf_page'
  | 'focused_recovery'
  | 'combining_outputs'
  | 'complete'

export interface AttachmentInterpretationProgress {
  detail?: string
  elapsedMs?: number
  finishedAt?: number
  label: string
  phase: AttachmentInterpretationPhase
  startedAt: number
  stepIndex?: number
  stepTotal?: number
  updatedAt: number
}

export interface UploadedAttachment {
  confidenceFlags?: DocumentConfidenceFlags
  demoCorrectionSource?: 'jordan_accommodation_actual'
  documentDraft?: StructuredDocumentDraft
  documentKind?: DocumentKind
  extractedText?: string
  file: File
  fileType: string
  id: string
  interpretationProgress?: AttachmentInterpretationProgress
  isDemoSeed?: boolean
  kind: AttachmentKind
  manualEditSummary?: string[]
  name: string
  notes: string[]
  rawTranscript?: string
  rawDemoOutput?: string
  readContainsUnclearText?: boolean
  readError?: string
  readMethod?: AttachmentReadMethod
  readNotes?: string[]
  pageCount?: number
  processedPageCount?: number
  previewUrl?: string
  previewUrlIsStatic?: boolean
  reviewedText?: string
  sizeLabel: string
  sourceTrailText?: string
  status: AttachmentStatus
}

export interface SourceMaterial {
  attachments: UploadedAttachment[]
  text: string
}

export interface AnalysisRequest {
  contextTags: TaskContext[]
  iepSource: SourceMaterial
  learningProfile?: string
  taskTraits?: TaskReviewDraft | null
  taskTitle: string
  teacherConcern?: string
  taskSource: SourceMaterial
}

export interface TeacherConcernRequest extends AnalysisRequest {
  teacherConcern: string
}

export interface AnalysisOptions {
  // When true, a Jordan demo rerun bypasses the fixed inference seed and
  // reseeds per run so a precached/demo output is not simply replayed.
  forceFresh?: boolean
}

export interface AnalysisMeta {
  adapterLabel: string
  mode: 'live' | 'demo'
  model: string
  notes: string[]
  runtimeLabel: string
  usedFallback: boolean
}

export interface AnalysisExecution {
  meta: AnalysisMeta
  result: AnalysisResult
}

export interface TeacherConcernExecution {
  meta: AnalysisMeta
  result: TeacherConcernEvaluation
}

export type { TaskReviewDraft }
