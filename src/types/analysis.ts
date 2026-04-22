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

export interface UploadedAttachment {
  confidenceFlags?: DocumentConfidenceFlags
  documentDraft?: StructuredDocumentDraft
  documentKind?: DocumentKind
  extractedText?: string
  file: File
  fileType: string
  id: string
  kind: AttachmentKind
  name: string
  notes: string[]
  rawTranscript?: string
  readContainsUnclearText?: boolean
  readError?: string
  readMethod?: AttachmentReadMethod
  readNotes?: string[]
  pageCount?: number
  processedPageCount?: number
  previewUrl?: string
  reviewedText?: string
  sizeLabel: string
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
