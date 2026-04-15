import type {
  AnalysisResult,
  TeacherConcernEvaluation,
} from '../lib/schema/analysisSchema'

export const roles = ['student', 'parent', 'teacher'] as const
export type Role = (typeof roles)[number]

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
export type AttachmentStatus = 'ready' | 'preview_only' | 'manual_review_needed'

export interface UploadedAttachment {
  extractedText?: string
  file: File
  fileType: string
  id: string
  kind: AttachmentKind
  name: string
  notes: string[]
  previewUrl?: string
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
  role: Role
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
