import { z } from 'zod'

export const documentKindSchema = z.enum([
  'iep_accommodations',
  'assignment_or_quiz',
  'unknown',
])

export const timedStatusSchema = z.enum(['timed', 'untimed', 'unknown'])
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
  calculationFocus: calculationFocusSchema,
  evidenceBullets: z.array(z.string()),
  sourceSummaryText: z.string(),
  subject: z.string(),
  taskDescription: z.string(),
  timedStatus: timedStatusSchema,
  topic: z.string(),
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
export type DocumentConfidenceFlags = z.infer<typeof documentConfidenceFlagsSchema>
export type DocumentKind = z.infer<typeof documentKindSchema>
export type DocumentReadingResult = z.infer<typeof documentReadingResultSchema>
export type IepReviewDraft = z.infer<typeof iepReviewDraftSchema>
export type IepSection = z.infer<typeof iepSectionSchema>
export type StructuredDocumentDraft =
  | z.infer<typeof iepReviewDraftSchema>
  | z.infer<typeof assignmentReviewDraftSchema>
  | z.infer<typeof unknownReviewDraftSchema>
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

function normalizeDocumentKind(value: unknown): DocumentKind | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().toLowerCase()

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
  ) {
    return 'assignment_or_quiz'
  }

  if (normalized === 'unknown' || normalized === 'other') {
    return 'unknown'
  }

  return undefined
}

function inferDocumentKindFromDraft(reviewDraft: unknown): DocumentKind {
  if (reviewDraft && typeof reviewDraft === 'object') {
    if ('sections' in reviewDraft) {
      return 'iep_accommodations'
    }

    if ('taskDescription' in reviewDraft) {
      return 'assignment_or_quiz'
    }
  }

  return 'unknown'
}

function normalizeReviewDraftByKind(
  documentKind: DocumentKind,
  reviewDraft: unknown,
): StructuredDocumentDraft {
  const draft = reviewDraft && typeof reviewDraft === 'object' ? reviewDraft : {}

  if (documentKind === 'iep_accommodations') {
    const sectionDrafts =
      'sections' in draft && Array.isArray(draft.sections)
        ? draft.sections
            .map((section) => {
              if (!section || typeof section !== 'object') {
                return null
              }

              return {
                items: asStringArray('items' in section ? section.items : undefined),
                title: asString('title' in section ? section.title : undefined),
              }
            })
            .filter((section): section is IepSection => section !== null)
        : []

    return {
      district: asString('district' in draft ? draft.district : undefined),
      dob: asString('dob' in draft ? draft.dob : undefined),
      learningDisabilityOrProfileText: asStringArray(
        'learningDisabilityOrProfileText' in draft
          ? draft.learningDisabilityOrProfileText
          : undefined,
      ),
      meetingDate: asString('meetingDate' in draft ? draft.meetingDate : undefined),
      modifications: asStringArray(
        'modifications' in draft ? draft.modifications : undefined,
      ),
      sections: sectionDrafts,
      sourceSummaryText: asString(
        'sourceSummaryText' in draft ? draft.sourceSummaryText : undefined,
      ),
      studentName: asString('studentName' in draft ? draft.studentName : undefined),
    }
  }

  if (documentKind === 'assignment_or_quiz') {
    const timedStatus =
      timedStatusSchema.safeParse('timedStatus' in draft ? draft.timedStatus : undefined)
        .data ?? 'unknown'
    const workType =
      workTypeSchema.safeParse('workType' in draft ? draft.workType : undefined).data
      ?? 'unknown'
    const calculationFocus =
      calculationFocusSchema.safeParse(
        'calculationFocus' in draft ? draft.calculationFocus : undefined,
      ).data ?? 'mixed_or_unknown'

    return {
      calculationFocus,
      evidenceBullets: asStringArray(
        'evidenceBullets' in draft ? draft.evidenceBullets : undefined,
      ),
      sourceSummaryText: asString(
        'sourceSummaryText' in draft ? draft.sourceSummaryText : undefined,
      ),
      subject: asString('subject' in draft ? draft.subject : undefined),
      taskDescription: asString(
        'taskDescription' in draft ? draft.taskDescription : undefined,
      ),
      timedStatus,
      topic: asString('topic' in draft ? draft.topic : undefined),
      workType,
    }
  }

  return {
    evidenceBullets: asStringArray(
      'evidenceBullets' in draft ? draft.evidenceBullets : undefined,
    ),
    sourceSummaryText: asString(
      'sourceSummaryText' in draft ? draft.sourceSummaryText : undefined,
    ),
    summary: asString('summary' in draft ? draft.summary : undefined),
  }
}

function normalizeDocumentReadingInput(input: unknown) {
  if (!input || typeof input !== 'object') {
    return input
  }

  const draft =
    'reviewDraft' in input
      ? (input as { reviewDraft?: unknown }).reviewDraft
      : undefined

  const documentKind =
    normalizeDocumentKind(
      'documentKind' in input
        ? (input as { documentKind?: unknown }).documentKind
        : undefined,
    ) ?? inferDocumentKindFromDraft(draft)

  return {
    ...input,
    confidenceFlags: {
      containsUnclearText: asBoolean(
        'confidenceFlags' in input
          && input.confidenceFlags
          && typeof input.confidenceFlags === 'object'
          && 'containsUnclearText' in input.confidenceFlags
          ? input.confidenceFlags.containsUnclearText
          : undefined,
      ),
      isPartialDocument: asBoolean(
        'confidenceFlags' in input
          && input.confidenceFlags
          && typeof input.confidenceFlags === 'object'
          && 'isPartialDocument' in input.confidenceFlags
          ? input.confidenceFlags.isPartialDocument
          : undefined,
      ),
      lowConfidence: asBoolean(
        'confidenceFlags' in input
          && input.confidenceFlags
          && typeof input.confidenceFlags === 'object'
          && 'lowConfidence' in input.confidenceFlags
          ? input.confidenceFlags.lowConfidence
          : undefined,
        true,
      ),
    },
    documentKind,
    notes: asStringArray('notes' in input ? input.notes : undefined),
    rawTranscript: asString('rawTranscript' in input ? input.rawTranscript : undefined),
    reviewDraft: normalizeReviewDraftByKind(documentKind, draft),
  }
}

export function parseDocumentReadingResult(input: unknown) {
  return documentReadingResultSchema.parse(normalizeDocumentReadingInput(input))
}
