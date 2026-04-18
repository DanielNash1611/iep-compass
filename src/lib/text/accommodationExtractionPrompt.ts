interface AccommodationPromptContext {
  attachmentKind?: 'image' | 'other' | 'pdf' | 'text'
  attachmentName?: string
  pageCount?: number
  pageIndex?: number
}

interface AccommodationPromptOptions {
  conditionFocus?: boolean
  photoMode?: boolean
}

export const ACCOMMODATION_EXTRACTION_SYSTEM_PROMPT = [
  'You are a careful document-reading assistant for IEP Compass.',
  'Follow the user request exactly.',
  'Return plain text only with no JSON, markdown, code fences, or extra commentary.',
  'Do not invent missing text.',
].join('\n')

const ACCOMMODATION_EXAMPLE_LINES = [
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
]

function buildPageContext(context?: AccommodationPromptContext) {
  if (!context?.attachmentKind || !context.attachmentName) {
    return null
  }

  if (
    context.attachmentKind === 'pdf'
    && typeof context.pageIndex === 'number'
    && typeof context.pageCount === 'number'
  ) {
    return `This image is page ${context.pageIndex} of ${context.pageCount} from the PDF "${context.attachmentName}".`
  }

  return `This image comes from the uploaded ${context.attachmentKind} file "${context.attachmentName}".`
}

export function buildAccommodationExtractionPrompt(
  context?: AccommodationPromptContext,
  options?: AccommodationPromptOptions,
) {
  if (options?.photoMode) {
    return [
      buildPageContext(context),
      context ? 'This upload was added under the approved IEP source area.' : null,
      'Tell me what is written on this accommodations page and extract the visible accommodation details.',
      'Return plain text only.',
      'This is a phone photo of a full accommodations form. The page may be sideways or rotated, so mentally rotate it until the text reads normally before extracting.',
      'Start with Student Information if it is visible, then copy the visible accommodations headings and the filled accommodation rows.',
      'Copy only wording that is visible on the page.',
      'Do not add accommodations from the prompt or from prior knowledge.',
      'Preserve exception language exactly when visible.',
      'If any word is unreadable, cropped, blank, or redacted, mark that exact spot as [unclear], [blank], or [redacted].',
      'Ignore the MODIFICATIONS paragraph, grading boxes, empty "None" rows, blank table cells, and repeated section labels unless they directly change a filled accommodation line.',
      'Prioritize the filled ACCOMMODATIONS rows over explanatory preamble or empty table structure.',
      'If a line is partly cut off, keep the readable part and use [unclear] for the missing part.',
      'If headings are visible but the lines under them are faint, copy the readable words under those headings and use [unclear] for the missing words instead of stopping at the heading.',
      'Keep visible headings like Student Information, Extracted Accommodations Details, Setting / Scheduling, Teacher Directions, Student Response, or Organization / Study Skills when they help organize the copied lines.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    buildPageContext(context),
    context ? 'This upload was added under the approved IEP source area.' : null,
    'Tell me what is written on this document and extract the accommodation details.',
    'Return plain text only.',
    'Read the page in the correct orientation before extracting text.',
    'Preserve the visible wording closely and keep every visible accommodation line you can read.',
    'Do not compress multiple accommodations into one line.',
    'Do not add accommodations from the prompt or from prior knowledge.',
    'Preserve exception language exactly when visible.',
    'If any word is unreadable, cropped, blank, or redacted, mark that exact spot as [unclear], [blank], or [redacted].',
    'If the page shows both MODIFICATIONS and ACCOMMODATIONS, copy the accommodations text and ignore the modifications text unless it directly changes the accommodation wording.',
    'If a page includes Accommodations plus Goals, Services, or Notes, copy the Accommodations section and ignore the other sections unless they directly change the accommodation wording.',
    'If a line is partly cut off, keep the readable part and use [unclear] for the missing part.',
    'If headings are visible but the lines under them are faint, copy the readable words under those headings and use [unclear] for the missing words instead of stopping at the heading.',
    'Prioritize accommodation lines over form instructions, explanatory preamble, or repeated section labels.',
    'Important: the example below only shows format. Do not copy any accommodation line from the example unless that wording is actually visible in the image.',
    'If the page is shorter and only shows one visible heading like "Writing accommodations", use that heading and only the lines under it.',
    'Use this exact shape when the document supports it:',
    ACCOMMODATION_EXAMPLE_LINES.join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildAccommodationFocusedExtractionPrompt(
  context?: AccommodationPromptContext,
  options?: AccommodationPromptOptions,
) {
  if (options?.conditionFocus) {
    return [
      buildPageContext(context),
      context ? 'This upload was added under the approved IEP source area.' : null,
      options.photoMode
        ? 'This phone photo may be sideways or rotated, so mentally rotate it until the text reads normally before extracting.'
        : null,
      'Tell me exactly what is written in the Student Response accommodation rows of this document.',
      'This may show only one narrow column or a few short lines.',
      'Copy only visible document text lines.',
      'If the Student Response heading is visible, keep it and then copy every filled line directly underneath it.',
      'Do not return only the heading when filled Student Response lines are visible.',
      'Preserve condition wording exactly, especially phrases like "when requested," "except on," "unless," and "except for."',
      'Do not simplify or drop exception wording from a visible line.',
      'Do not add example accommodations, missing categories, or instructions from this prompt.',
      'Ignore neighboring columns, blank rows, and modifications text unless they directly change a visible Student Response line.',
      'If even one filled line is readable, return that line instead of stopping at the heading.',
      'If part of a condition is hard to read, keep the readable words and use [unclear] for the rest.',
      'Return plain text only.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (options?.photoMode) {
    return [
      buildPageContext(context),
      context ? 'This upload was added under the approved IEP source area.' : null,
      'Tell me exactly what is written in the accommodations rows of this document.',
      'This phone photo may be sideways or rotated, so mentally rotate it until the text reads normally before extracting.',
      'Copy only visible document text lines.',
      'Copy the filled accommodation rows and the headings needed to organize them.',
      'Do not add example accommodations, missing categories, or instructions from this prompt.',
      'Ignore the MODIFICATIONS paragraph, goals, services, grading boxes, empty "None" rows, blank table cells, and repeated section labels unless they directly change a filled accommodation line.',
      'Prioritize the filled ACCOMMODATIONS rows over boilerplate instructions or empty table structure.',
      'If a heading is visible but the line under it is faint, keep the readable words and use [unclear] for the rest.',
      'If a word is hard to read, use [unclear].',
      'Return plain text only.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    buildPageContext(context),
    context ? 'This upload was added under the approved IEP source area.' : null,
    'Tell me exactly what is written on the accommodations part of this document.',
    'This may be only a short accommodation snippet, not a full page.',
    'Copy only visible document text lines.',
    'Do not add example accommodations, missing categories, or instructions from this prompt.',
    'If the page shows MODIFICATIONS and ACCOMMODATIONS, ignore the modifications wording unless it directly changes an accommodation line.',
    'Ignore goals, services, form instructions, and repeated section labels unless they are part of a visible accommodation line.',
    'If there is one visible heading, keep that heading and only the lines under it.',
    'If a heading is visible but the line under it is faint, keep the readable words and use [unclear] for the rest.',
    'If a word is hard to read, use [unclear].',
    'Return plain text only.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildAccommodationConsolidationPrompt(drafts: string[]) {
  return [
    'You are merging OCR drafts of the same accommodations page for IEP Compass.',
    'Return one final plain-text draft for direct pasting into the accommodations text box.',
    'Use only wording supported by the drafts below.',
    'Prefer lines that look like direct document text over summaries, guesses, or boilerplate.',
    'If a section heading or accommodation appears in only one draft but looks like direct document text, you may keep it.',
    'If the drafts disagree, choose the more literal wording or use [unclear] for the disputed part.',
    'Do not invent new accommodations.',
    'Do not keep prompt leakage, repeated form labels, or generic summary lines unless they are clearly visible document text.',
    'Preserve exception language exactly when present in any draft.',
    'Keep visible section headings when helpful.',
    'Return plain text only.',
    '',
    drafts
      .map((draft, index) => [`Draft ${index + 1}:`, draft.trim() || '[blank]'].join('\n'))
      .join('\n\n'),
  ].join('\n')
}
