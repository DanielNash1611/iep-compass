import {
  parseDocumentReadingResult,
  type DocumentReadingResult,
} from './ocrSchema.ts'
import { toStudentFacingFollowUp } from '../text/assignmentFollowUps.ts'

function splitTaskNotes(extractedText: string) {
  return extractedText
    .split('\n')
    .map((line) =>
      line
        .replace(/^[-*•\s]+/, '')
        .replace(/^\d+[.)]\s*/, '')
        .trim(),
    )
    .filter(Boolean)
}

function hasAnyTextMatch(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function inferVisibleDocumentType(extractedText: string) {
  if (/rubric|criteria|scoring|graded|grade/i.test(extractedText)) {
    return 'rubric'
  }

  if (/worksheet|problems?|questions?|practice/i.test(extractedText)) {
    return /quiz/i.test(extractedText) ? 'quiz' : 'worksheet'
  }

  if (/quiz/i.test(extractedText)) {
    return 'quiz'
  }

  if (/\btest\b|exam|assessment/i.test(extractedText)) {
    return 'test'
  }

  if (/due|deadline|submit|directions|instructions/i.test(extractedText)) {
    return 'assignment_details'
  }

  if (/assignment|task|classwork|homework/i.test(extractedText)) {
    return 'assignment_page'
  }

  return 'unknown'
}

function inferWorkType(extractedText: string) {
  if (/quiz/i.test(extractedText)) {
    return /practice|review|prep/i.test(extractedText) ? 'practice' : 'quiz'
  }

  if (/\btest\b|exam|assessment/i.test(extractedText)) {
    return 'test'
  }

  if (/worksheet/i.test(extractedText)) {
    return 'worksheet'
  }

  if (/practice|review|prep/i.test(extractedText)) {
    return 'practice'
  }

  if (/homework/i.test(extractedText)) {
    return 'homework'
  }

  if (/classwork/i.test(extractedText)) {
    return 'classwork'
  }

  return 'unknown'
}

function inferAccommodationFocus(extractedText: string) {
  if (/quiz/i.test(extractedText) && /practice|review|prep/i.test(extractedText)) {
    return 'practice'
  }

  if (/quiz/i.test(extractedText)) {
    return 'quiz'
  }

  if (/\btest\b|exam|assessment/i.test(extractedText)) {
    return 'test'
  }

  if (/assignment|worksheet|classwork|homework|rubric|task/i.test(extractedText)) {
    return 'assignment'
  }

  return 'unknown'
}

function inferTimedStatus(extractedText: string) {
  if (/untimed|not timed|no time limit/i.test(extractedText)) {
    return 'untimed'
  }

  if (/\b\d+\s*(?:min|mins|minute|minutes)\b|time limit|timed/i.test(extractedText)) {
    return 'timed'
  }

  return 'unknown'
}

function inferTimeLimitMinutes(extractedText: string) {
  const match = extractedText.match(/\b(\d{1,3})\s*(?:min|mins|minute|minutes)\b/i)

  if (!match) {
    return null
  }

  const minutes = Number(match[1])

  return Number.isFinite(minutes) && minutes > 0 ? minutes : null
}

function inferCalculationFocus(extractedText: string) {
  if (
    hasAnyTextMatch(extractedText, [
      /math|calculate|calculation|equation|area|circle|composite figure|geometry|graph|fraction|decimal/i,
    ])
  ) {
    return 'calculation_focused'
  }

  if (
    hasAnyTextMatch(extractedText, [
      /essay|paragraph|writing|reading|rubric|spelling|grammar|mechanics|presentation/i,
    ])
  ) {
    return 'not_calculation_focused'
  }

  return 'mixed_or_unknown'
}

function inferSubject(extractedText: string) {
  if (/math|geometry|algebra|circle|fraction|equation/i.test(extractedText)) {
    return 'Math'
  }

  if (/essay|writing|reading|ela|english|grammar|spelling/i.test(extractedText)) {
    return 'ELA'
  }

  if (/science|lab|ecosystem|biology|chemistry|physics/i.test(extractedText)) {
    return 'Science'
  }

  if (/history|social studies|civics|geography/i.test(extractedText)) {
    return 'Social studies'
  }

  return ''
}

function buildTaskFollowUpQuestions(extractedText: string) {
  const questions: string[] = []

  if (/quiz/i.test(extractedText) && /practice|review|prep/i.test(extractedText)) {
    questions.push(
      'Check whether your accommodations should be matched to this practice work, the actual quiz/test, or both.',
    )
  }

  if (!/untimed|not timed|no time limit/i.test(extractedText)) {
    questions.push('Check whether this task is timed.')
    questions.push('Write how many minutes you have if this task is timed.')
  }

  if (/rubric|spelling|grammar|mechanics/i.test(extractedText)) {
    questions.push('Check whether spelling or grammar counts toward the final score.')
  }

  return questions.map(toStudentFacingFollowUp)
}

export function assertRenderableDocumentResult(result: DocumentReadingResult) {
  if (result.documentKind === 'assignment_or_quiz') {
    const draft = result.reviewDraft
    const hasTaskOutput =
      draft.taskDescription.trim()
      || draft.accessRelevantDetails.some((item) => item.trim())
      || draft.evidenceBullets.some((item) => item.trim())

    if (!hasTaskOutput) {
      throw new Error('Gemma returned a task draft with no reviewable summary.')
    }
  }

  if (result.documentKind === 'unknown') {
    const draft = result.reviewDraft
    const hasUnknownOutput =
      draft.summary.trim()
      || draft.evidenceBullets.some((item) => item.trim())
      || draft.sourceSummaryText.trim()

    if (!hasUnknownOutput) {
      throw new Error('Gemma returned an empty document summary.')
    }
  }
}

export function buildTaskDocumentResultFromPlainText(
  extractedText: string,
  attachmentName: string,
): DocumentReadingResult {
  const trimmedText = extractedText.trim()

  if (!trimmedText) {
    throw new Error('Gemma did not produce any task notes to review.')
  }

  const lines = splitTaskNotes(trimmedText)
  const appearsUnusable =
    lines.length === 0
    || (
      /unreadable|cannot read|can't read|not enough visible|does not appear to be schoolwork|not schoolwork/i.test(trimmedText)
      && !hasAnyTextMatch(trimmedText, [
        /assignment|worksheet|quiz|test|rubric|practice|task|classwork|homework/i,
      ])
    )

  if (appearsUnusable) {
    throw new Error(
      'Gemma could not identify a reviewable assignment, quiz, worksheet, test, or rubric from this upload.',
    )
  }

  const taskDescription = lines.slice(0, 3).join('\n')
  const visibleDocumentType = inferVisibleDocumentType(trimmedText)
  const evidenceBullets = lines.slice(0, 6)
  const accessRelevantDetails = lines
    .filter((line) =>
      /timed|minutes?|rubric|grade|spelling|grammar|reading|writing|multi-step|directions|calculator|calculation|math|materials?|deadline|due|allowed/i.test(line),
    )
    .slice(0, 6)
  const parsedResult = parseDocumentReadingResult({
    confidenceFlags: {
      containsUnclearText: /\[unclear\]|unreadable|blurry|cropped/i.test(trimmedText),
      isPartialDocument: /cropped|partial|cut off|another page|not visible/i.test(trimmedText),
      lowConfidence: visibleDocumentType === 'unknown',
    },
    documentKind: 'assignment_or_quiz',
    notes: [
      'Gemma read this upload as plain text notes first, then IEP Compass converted those notes into this review draft.',
    ],
    rawTranscript: trimmedText,
    reviewDraft: {
      accessRelevantDetails:
        accessRelevantDetails.length > 0
          ? accessRelevantDetails
          : ['Review the task summary and visible evidence before using this upload.'],
      accommodationFocus: inferAccommodationFocus(trimmedText),
      calculationFocus: inferCalculationFocus(trimmedText),
      evidenceBullets,
      followUpQuestions: buildTaskFollowUpQuestions(trimmedText),
      sourceSummaryText: '',
      subject: inferSubject(trimmedText),
      taskDescription:
        taskDescription
        || `Gemma recognized "${attachmentName}" as a task upload, but the summary needs review.`,
      timeLimitMinutes: inferTimeLimitMinutes(trimmedText),
      timedStatus: inferTimedStatus(trimmedText),
      topic: '',
      visibleDocumentType,
      workType: inferWorkType(trimmedText),
    },
  })

  assertRenderableDocumentResult(parsedResult)

  return parsedResult
}
