import {
  assignmentRequirementTypeSchema,
  assignmentTypeSchema,
  imageDocumentTypeSchema,
} from '../../../src/lib/schema/imageInterpretationSchema.ts'
import {
  buildAccommodationConsolidationPrompt,
  buildAccommodationExtractionPrompt,
  buildAccommodationFocusedExtractionPrompt,
} from '../../../src/lib/text/accommodationExtractionPrompt.ts'

const DOCUMENT_TYPES = imageDocumentTypeSchema.options.join(', ')
const ASSIGNMENT_TYPES = assignmentTypeSchema.options.join(', ')
const REQUIREMENT_TYPES = assignmentRequirementTypeSchema.options.join(', ')

export function buildAccommodationImageInterpretationPrompt() {
  return buildAccommodationImageManualFlowPrompt('eval')
}

export function buildAccommodationImageManualFlowPrompt(
  profile: 'app' | 'eval' = 'eval',
  options?: {
    photoMode?: boolean
  },
) {
  if (profile === 'app') {
    return buildAccommodationExtractionPrompt(undefined, {
      photoMode: options?.photoMode,
    })
  }

  return [
    'Tell me what is written on this document and extract the accommodation details.',
    'Return plain text only.',
    'Read the page in the correct orientation before extracting text.',
    'Preserve the visible wording closely and keep every visible accommodation line you can read.',
    'Do not compress multiple accommodations into one line.',
    'Preserve exception language exactly when visible.',
    'If a field is unreadable, cropped, blank, or redacted, say [unclear], [blank], or [redacted] instead of leaving it empty.',
    'Use this exact shape when the document supports it:',
    [
      'Student Information',
      'Student Name: Chappell, Juliette Christine',
      'Date of Birth: 7/12/2013',
      'Meeting Date: 11/19/2025',
      'Overall Report Card Type: Regular',
      'Extracted Accommodations Details',
      'The document lists specific supports divided into several categories:',
      '',
      '1. Setting / Scheduling',
      'Test in a small group when requested.',
      'Extended time to complete assignments (2 days).',
      'Extended time on tests (2 days).',
      'Seat away from distractions/noise.',
      '',
      '2. Teacher Directions',
      'Directions provided in a variety of ways.',
      'Frequent checks for understanding.',
      'Answer choices read aloud when requested.',
      'Verbal encouragement.',
      'Questions or items presented orally when requested.',
      '',
      '3. Student Response',
      'Use of speech-to-text application.',
      'No penalty for spelling (except on spelling tasks).',
      'No penalty for grammar (unless it is a grammar task).',
      'Use of a calculator (except for calculation tests).',
      'Use of a multiplication chart.',
      '',
      '4. Organization / Study Skills',
      'Use of graphic organizers.',
      'Teacher-provided notes.',
      'Graph paper for math.',
      '',
      '5. Self-Regulation & Personal Care / Equipment',
      'None listed.',
    ].join('\n'),
  ].join('\n')
}

export function buildAccommodationImageFocusedPrompt(options?: {
  conditionFocus?: boolean
  photoMode?: boolean
}) {
  return buildAccommodationFocusedExtractionPrompt(undefined, {
    conditionFocus: options?.conditionFocus,
    photoMode: options?.photoMode,
  })
}

export function buildAccommodationImageConsolidationPrompt(drafts: string[]) {
  return buildAccommodationConsolidationPrompt(drafts)
}

export function buildAccommodationImageStructuringPrompt(extractedText: string) {
  return [
    'Accommodation uploads now use plain review text rather than a structured JSON schema.',
    'Return the extracted notes unchanged except for minor cleanup of whitespace.',
    '',
    extractedText.trim(),
  ].join('\n')
}

export function buildAssignmentImageInterpretationPrompt() {
  return [
    'Look at this school document image and interpret the assignment or rubric details that matter for accommodation matching.',
    'You are evaluating a school assignment, worksheet, quiz, test, or rubric image for IEP Compass.',
    'Identify the visible document type, summarize the task, and extract only clearly supported requirements and grading factors.',
    'This does not need full text extraction, but it must preserve short visible wording for key requirements, deadlines, grading factors, and directions.',
    'Preserve visible title and label wording such as "Quiz Practice", "Areas of Circles", or "Composite Figures" in task_summary or access_relevant_details when visible.',
    'Never answer assignment, worksheet, quiz, or test questions.',
    'Include access_relevant_details for visible traits like timing, rubric categories, spelling/mechanics grading, reading load, writing load, multi-step directions, allowed materials, or calculation focus.',
    'Include short follow_up_questions that would clarify accommodation relevance, such as "Is this a timed test?" or "Does the rubric include spelling?".',
    'If the page appears to be quiz practice, test practice, or preparation for another assessment, ask whether the accommodation check should focus on the practice work or the actual quiz/test.',
    'If timing is visible or likely but not confirmed, ask whether it is timed and how many minutes the student has.',
    'Note incomplete visibility when directions, scoring details, or deadlines may be cut off.',
    'Do not infer unseen instructions, missing pages, or hidden rubric criteria.',
    `Use one of these document_type values: ${DOCUMENT_TYPES}.`,
    `Use one of these assignment_type values: ${ASSIGNMENT_TYPES}.`,
    `Use one of these requirement type values: ${REQUIREMENT_TYPES}.`,
    'Set must_ask_for_more_context true when the image appears partial, cropped, blurry, or otherwise incomplete for reliable interpretation.',
    'Return JSON only with this shape:',
    JSON.stringify({
      access_relevant_details: [
        'Rubric includes grammar and spelling',
        'Assignment asks for a multi-paragraph written response',
      ],
      assignment_type: 'essay',
      confidence: 0.84,
      detected_requirements: [
        {
          text: '5 paragraph essay',
          type: 'written_output',
        },
        {
          text: 'Grammar and spelling count toward final score',
          type: 'spelling_mechanics',
        },
        {
          text: 'Due Friday',
          type: 'deadline',
        },
      ],
      document_type: 'assignment_rubric',
      follow_up_questions: [
        'Is this writing assignment timed?',
        'Does spelling count toward the final score?',
      ],
      grading_factors: ['organization', 'supporting evidence', 'grammar', 'spelling'],
      must_ask_for_more_context: false,
      task_summary: 'Write a 5 paragraph essay on ecosystems.',
    }),
  ].join('\n')
}

export function buildAssignmentImageManualFlowPrompt() {
  return [
    'Look at this school document image and identify what kind of assignment document it appears to be.',
    'Summarize the task, visible requirements, deadlines, grading factors, and access-relevant details in plain text.',
    'List short follow-up questions that would clarify accommodation relevance.',
    'If the page appears to be quiz practice, test practice, or preparation for another assessment, note that ambiguity and ask whether the accommodation check should focus on the practice work or the actual quiz/test.',
    'If timing is visible or likely but not confirmed, note the visible time clue or uncertainty and ask whether it is timed and how many minutes the student has.',
    'Preserve visible title and label wording such as "Quiz Practice", "Areas of Circles", or "Composite Figures" when visible.',
    'Do not transcribe the whole page, but do preserve short visible wording for requirements, deadlines, grading factors, and directions.',
    'Never answer assignment, worksheet, quiz, or test questions.',
    'Do not invent unseen instructions.',
  ].join('\n')
}

export function buildAssignmentImageStructuringPrompt(extractedText: string) {
  return [
    'Convert the extracted assignment or rubric notes below into JSON for IEP Compass.',
    'Use only facts present in the extracted notes.',
    'Keep follow_up_questions as short questions about missing or unclear context.',
    'For quiz practice, test practice, or assessment-prep pages, include a follow_up_question asking whether accommodation matching should focus on the practice work or the actual quiz/test.',
    'When timing is visible, likely, or unclear, include follow_up_questions about timed status and minutes instead of inventing a time limit.',
    'Carry visible title and label wording from the notes into task_summary or access_relevant_details instead of replacing it with generic wording.',
    `Use one of these document_type values: ${DOCUMENT_TYPES}.`,
    `Use one of these assignment_type values: ${ASSIGNMENT_TYPES}.`,
    `Use one of these requirement type values: ${REQUIREMENT_TYPES}.`,
    'Return JSON only with this shape:',
    JSON.stringify({
      access_relevant_details: [
        'Rubric includes grammar and spelling',
        'Assignment asks for a multi-paragraph written response',
      ],
      assignment_type: 'essay',
      confidence: 0.84,
      detected_requirements: [
        {
          text: '5 paragraph essay',
          type: 'written_output',
        },
        {
          text: 'Grammar and spelling count toward final score',
          type: 'spelling_mechanics',
        },
        {
          text: 'Due Friday',
          type: 'deadline',
        },
      ],
      document_type: 'assignment_rubric',
      follow_up_questions: [
        'Is this writing assignment timed?',
        'Does spelling count toward the final score?',
      ],
      grading_factors: ['organization', 'supporting evidence', 'grammar', 'spelling'],
      must_ask_for_more_context: false,
      task_summary: 'Write a 5 paragraph essay on ecosystems.',
    }),
    '',
    'Extracted notes:',
    extractedText,
  ].join('\n')
}
