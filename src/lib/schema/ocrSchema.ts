import { z } from 'zod'
import { buildAssignmentFollowUpQuestions } from '../text/assignmentFollowUps.ts'

export const documentKindSchema = z.enum([
  'iep_accommodations',
  'assignment_or_quiz',
  'unknown',
])

export const timedStatusSchema = z.enum(['timed', 'untimed', 'unknown'])
export const accommodationFocusSchema = z.enum([
  'assignment',
  'practice',
  'quiz',
  'test',
  'unknown',
])
export const calculationFocusSchema = z.enum([
  'calculation_focused',
  'not_calculation_focused',
  'mixed_or_unknown',
])
export const workTypeSchema = z.enum([
  'worksheet',
  'quiz',
  'test',
  'practice',
  'classwork',
  'homework',
  'unknown',
])
export const taskDocumentTypeSchema = z.enum([
  'assignment_details',
  'assignment_page',
  'rubric',
  'worksheet',
  'quiz',
  'test',
  'unknown',
])

export const documentConfidenceFlagsSchema = z.object({
  containsUnclearText: z.boolean(),
  isPartialDocument: z.boolean(),
  lowConfidence: z.boolean(),
})

export const iepSectionSchema = z.object({
  items: z.array(z.string()),
  title: z.string(),
})

export const iepReviewDraftSchema = z.object({
  district: z.string(),
  dob: z.string(),
  learningDisabilityOrProfileText: z.array(z.string()),
  meetingDate: z.string(),
  modifications: z.array(z.string()),
  sections: z.array(iepSectionSchema),
  sourceSummaryText: z.string(),
  studentName: z.string(),
})

export const assignmentReviewDraftSchema = z.object({
  accessRelevantDetails: z.array(z.string()),
  accommodationFocus: accommodationFocusSchema,
  calculationFocus: calculationFocusSchema,
  evidenceBullets: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  sourceSummaryText: z.string(),
  subject: z.string(),
  taskDescription: z.string(),
  timeLimitMinutes: z.number().nullable(),
  timedStatus: timedStatusSchema,
  topic: z.string(),
  visibleDocumentType: taskDocumentTypeSchema,
  workType: workTypeSchema,
})

export const unknownReviewDraftSchema = z.object({
  evidenceBullets: z.array(z.string()),
  sourceSummaryText: z.string(),
  summary: z.string(),
})

export const iepDocumentReadingResultSchema = z.object({
  confidenceFlags: documentConfidenceFlagsSchema,
  documentKind: z.literal('iep_accommodations'),
  notes: z.array(z.string()),
  rawTranscript: z.string(),
  reviewDraft: iepReviewDraftSchema,
})

export const assignmentDocumentReadingResultSchema = z.object({
  confidenceFlags: documentConfidenceFlagsSchema,
  documentKind: z.literal('assignment_or_quiz'),
  notes: z.array(z.string()),
  rawTranscript: z.string(),
  reviewDraft: assignmentReviewDraftSchema,
})

export const unknownDocumentReadingResultSchema = z.object({
  confidenceFlags: documentConfidenceFlagsSchema,
  documentKind: z.literal('unknown'),
  notes: z.array(z.string()),
  rawTranscript: z.string(),
  reviewDraft: unknownReviewDraftSchema,
})

export const documentReadingResultSchema = z.discriminatedUnion('documentKind', [
  iepDocumentReadingResultSchema,
  assignmentDocumentReadingResultSchema,
  unknownDocumentReadingResultSchema,
])

export type CalculationFocus = z.infer<typeof calculationFocusSchema>
export type AccommodationFocus = z.infer<typeof accommodationFocusSchema>
export type DocumentConfidenceFlags = z.infer<typeof documentConfidenceFlagsSchema>
export type DocumentKind = z.infer<typeof documentKindSchema>
export type DocumentReadingResult = z.infer<typeof documentReadingResultSchema>
export type IepReviewDraft = z.infer<typeof iepReviewDraftSchema>
export type IepSection = z.infer<typeof iepSectionSchema>
export type StructuredDocumentDraft =
  | z.infer<typeof iepReviewDraftSchema>
  | z.infer<typeof assignmentReviewDraftSchema>
  | z.infer<typeof unknownReviewDraftSchema>
export type TaskDocumentType = z.infer<typeof taskDocumentTypeSchema>
export type TaskReviewDraft = z.infer<typeof assignmentReviewDraftSchema>
export type TimedStatus = z.infer<typeof timedStatusSchema>
export type UnknownReviewDraft = z.infer<typeof unknownReviewDraftSchema>
export type WorkType = z.infer<typeof workTypeSchema>

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function asNullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return null
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function field(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in record) {
      return record[key]
    }
  }

  return undefined
}

function normalizeDocumentKind(value: unknown): DocumentKind | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')

  if (
    normalized === 'iep_accommodations'
    || normalized === 'iep'
    || normalized === 'iep_accommodation'
    || normalized === 'iep_accommodations_form'
    || normalized === 'accommodations'
    || normalized === 'accommodation_form'
    || normalized === 'accommodation_sheet'
  ) {
    return 'iep_accommodations'
  }

  if (
    normalized === 'assignment_or_quiz'
    || normalized === 'assignment'
    || normalized === 'quiz'
    || normalized === 'task'
    || normalized === 'worksheet'
    || normalized === 'assignment_or_test'
    || normalized === 'assignment_quiz'
    || normalized === 'assignment_sheet'
    || normalized === 'assignment_or_schoolwork'
    || normalized === 'assignment_or_worksheet'
  ) {
    return 'assignment_or_quiz'
  }

  if (normalized === 'unknown' || normalized === 'other') {
    return 'unknown'
  }

  return undefined
}

function inferDocumentKindFromDraft(reviewDraft: unknown): DocumentKind {
  const draft = getRecord(reviewDraft)

  if (Object.keys(draft).length > 0) {
    if (field(draft, 'sections', 'accommodationSections', 'accommodation_sections')) {
      return 'iep_accommodations'
    }

    if (field(draft, 'taskDescription', 'task_description', 'task_summary')) {
      return 'assignment_or_quiz'
    }
  }

  return 'unknown'
}

function normalizeReviewDraftByKind(
  documentKind: DocumentKind,
  reviewDraft: unknown,
): StructuredDocumentDraft {
  const draft = getRecord(reviewDraft)

  if (documentKind === 'iep_accommodations') {
    const sections = field(
      draft,
      'sections',
      'accommodationSections',
      'accommodation_sections',
    )
    const sectionDrafts =
      Array.isArray(sections)
        ? sections
          .map((section) => {
            const sectionRecord = getRecord(section)

            if (Object.keys(sectionRecord).length === 0) {
              return null
            }

            return {
              items: asStringArray(
                field(sectionRecord, 'items', 'accommodations', 'supports'),
              ),
              title: asString(field(sectionRecord, 'title', 'heading', 'name')),
            }
          })
          .filter((section): section is IepSection => section !== null)
        : []

    return {
      district: asString(field(draft, 'district')),
      dob: asString(field(draft, 'dob', 'dateOfBirth', 'date_of_birth')),
      learningDisabilityOrProfileText: asStringArray(
        field(
          draft,
          'learningDisabilityOrProfileText',
          'learning_disability_or_profile_text',
          'profileText',
          'profile_text',
        ),
      ),
      meetingDate: asString(field(draft, 'meetingDate', 'meeting_date')),
      modifications: asStringArray(
        field(draft, 'modifications'),
      ),
      sections: sectionDrafts,
      sourceSummaryText: asString(
        field(draft, 'sourceSummaryText', 'source_summary_text', 'summary'),
      ),
      studentName: asString(field(draft, 'studentName', 'student_name')),
    }
  }

  if (documentKind === 'assignment_or_quiz') {
    const timedStatus =
      timedStatusSchema.safeParse(field(draft, 'timedStatus', 'timed_status'))
        .data ?? 'unknown'
    const workType =
      workTypeSchema.safeParse(field(draft, 'workType', 'work_type')).data
      ?? 'unknown'
    const calculationFocus =
      calculationFocusSchema.safeParse(
        field(draft, 'calculationFocus', 'calculation_focus'),
      ).data ?? 'mixed_or_unknown'
    const visibleDocumentType =
      taskDocumentTypeSchema.safeParse(
        field(draft, 'visibleDocumentType', 'visible_document_type'),
      ).data ?? 'unknown'
    const accommodationFocus =
      accommodationFocusSchema.safeParse(
        field(draft, 'accommodationFocus', 'accommodation_focus'),
      ).data ?? 'unknown'

    const normalizedDraft = {
      accessRelevantDetails: asStringArray(
        field(draft, 'accessRelevantDetails', 'access_relevant_details'),
      ),
      accommodationFocus,
      calculationFocus,
      evidenceBullets: asStringArray(
        field(draft, 'evidenceBullets', 'evidence_bullets', 'evidence'),
      ),
      followUpQuestions: asStringArray(
        field(draft, 'followUpQuestions', 'follow_up_questions'),
      ),
      sourceSummaryText: asString(
        field(draft, 'sourceSummaryText', 'source_summary_text', 'task_summary'),
      ),
      subject: asString(field(draft, 'subject')),
      taskDescription: asString(
        field(draft, 'taskDescription', 'task_description', 'task_summary'),
      ),
      timeLimitMinutes: asNullableNumber(
        field(draft, 'timeLimitMinutes', 'time_limit_minutes'),
      ),
      timedStatus,
      topic: asString(field(draft, 'topic')),
      visibleDocumentType,
      workType,
    }

    return {
      ...normalizedDraft,
      followUpQuestions: buildAssignmentFollowUpQuestions(normalizedDraft),
    }
  }

  return {
    evidenceBullets: asStringArray(
      field(draft, 'evidenceBullets', 'evidence_bullets', 'evidence'),
    ),
    sourceSummaryText: asString(
      field(draft, 'sourceSummaryText', 'source_summary_text'),
    ),
    summary: asString(field(draft, 'summary', 'task_summary')),
  }
}

function unwrapDocumentReadingEnvelope(input: Record<string, unknown>) {
  const candidate = field(
    input,
    'documentReadingResult',
    'document_reading_result',
    'documentResult',
    'document_result',
    'result',
    'output',
    'data',
  )

  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>
  }

  return input
}

function normalizeDocumentReadingInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input
  }

  const inputRecord = unwrapDocumentReadingEnvelope(input as Record<string, unknown>)
  const draft =
    field(inputRecord, 'reviewDraft', 'review_draft', 'draft')

  const documentKind =
    normalizeDocumentKind(
      field(inputRecord, 'documentKind', 'document_kind'),
    ) ?? inferDocumentKindFromDraft(draft)

  return {
    ...inputRecord,
    confidenceFlags: {
      containsUnclearText: asBoolean(
        field(
          getRecord(field(inputRecord, 'confidenceFlags', 'confidence_flags')),
          'containsUnclearText',
          'contains_unclear_text',
        ),
      ),
      isPartialDocument: asBoolean(
        field(
          getRecord(field(inputRecord, 'confidenceFlags', 'confidence_flags')),
          'isPartialDocument',
          'is_partial_document',
        ),
      ),
      lowConfidence: asBoolean(
        field(
          getRecord(field(inputRecord, 'confidenceFlags', 'confidence_flags')),
          'lowConfidence',
          'low_confidence',
        ),
        true,
      ),
    },
    documentKind,
    notes: asStringArray(field(inputRecord, 'notes')),
    rawTranscript: asString(
      field(inputRecord, 'rawTranscript', 'raw_transcript', 'transcript'),
    ),
    reviewDraft: normalizeReviewDraftByKind(documentKind, draft),
  }
}

export function parseDocumentReadingResult(input: unknown) {
  return documentReadingResultSchema.parse(normalizeDocumentReadingInput(input))
}
