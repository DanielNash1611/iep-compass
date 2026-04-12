import type { AnalysisResult } from '../lib/schema/analysisSchema'

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

export interface AnalysisRequest {
  attachments: UploadedAttachment[]
  contextTags: TaskContext[]
  iepExcerpt: string
  role: Role
  taskText: string
}

export interface AnalysisExecution {
  meta: {
    adapterLabel: string
    mode: 'remote' | 'demo'
    model: string
    notes: string[]
    usedFallback: boolean
  }
  result: AnalysisResult
}
