import {
  parseDocumentReadingResult,
  type DocumentReadingResult,
} from './ocrSchema.ts'

type SourceKey = 'iep' | 'task'

function splitTranscriptEvidence(rawTranscript: string) {
  return rawTranscript
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 5)
}

function buildTaskFallbackDescription(
  attachmentName: string,
  rawTranscript: string,
) {
  const transcriptLines = splitTranscriptEvidence(rawTranscript)

  if (transcriptLines.length > 0) {
    return transcriptLines.join('\n')
  }

  return [
    `Gemma recognized "${attachmentName}" as a task upload, but it did not extract readable task wording.`,
    'Add a short task summary here before running the accommodation check.',
  ].join(' ')
}

export function recoverBlankTaskDocumentResult(
  result: DocumentReadingResult,
  attachmentName: string,
  sourceKey: SourceKey,
): DocumentReadingResult {
  if (sourceKey !== 'task' || result.documentKind !== 'unknown') {
    return result
  }

  const reviewDraft = result.reviewDraft
  const hasVisibleDraft =
    reviewDraft.summary.trim()
    || reviewDraft.evidenceBullets.some((item) => item.trim())
    || reviewDraft.sourceSummaryText.trim()

  if (hasVisibleDraft) {
    return result
  }

  const taskDescription = buildTaskFallbackDescription(
    attachmentName,
    result.rawTranscript,
  )
  const evidenceBullets = splitTranscriptEvidence(result.rawTranscript)
  const fallbackEvidence =
    evidenceBullets.length > 0
      ? evidenceBullets
      : ['Gemma did not extract readable task wording from this image.']

  return parseDocumentReadingResult({
    ...result,
    confidenceFlags: {
      ...result.confidenceFlags,
      containsUnclearText: true,
      lowConfidence: true,
    },
    documentKind: 'assignment_or_quiz',
    notes: Array.from(
      new Set([
        ...result.notes,
        'Gemma returned a blank unknown draft, so IEP Compass created a low-confidence task review draft instead of showing empty fields.',
      ]),
    ),
    reviewDraft: {
      accessRelevantDetails: [
        'Task details need review because Gemma did not extract a confident structured draft.',
      ],
      accommodationFocus: 'unknown',
      calculationFocus: 'mixed_or_unknown',
      evidenceBullets: fallbackEvidence,
      followUpQuestions: [
        'What assignment, quiz, or practice task should the accommodation check use?',
        'Is this task timed?',
        'If it is timed, how many minutes does the student have?',
      ],
      sourceSummaryText: '',
      subject: '',
      taskDescription,
      timeLimitMinutes: null,
      timedStatus: 'unknown',
      topic: '',
      visibleDocumentType: 'unknown',
      workType: 'unknown',
    },
  })
}
