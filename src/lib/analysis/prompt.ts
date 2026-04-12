import type { AnalysisRequest } from '../../types/analysis'

export const GEMMA_PRIMARY_MODEL_ID = 'gemma-4-e4b'
export const GEMMA_PRIMARY_MODEL_LABEL = 'Gemma 4 E4B'
export const GEMMA_FALLBACK_MODEL_ID = 'gemma-4-e2b'
export const GEMMA_FALLBACK_MODEL_LABEL = 'Gemma 4 E2B'

const OUTPUT_SHAPE = `{
  "summary": "string",
  "relevantAccommodations": [
    {
      "name": "string",
      "sourceText": "string",
      "plainLanguage": "string",
      "whyItMayMatter": "string",
      "confidence": "likely_relevant | possibly_relevant | unclear_confirm",
      "implementationNotes": ["string"]
    }
  ],
  "notObviouslyRelevant": [
    {
      "name": "string",
      "reason": "string"
    }
  ],
  "studentAdvocacy": {
    "suggestedScript": "string",
    "alternativeScripts": ["string"]
  },
  "teacherReminders": ["string"],
  "boundaries": ["string"]
}`

export function buildGemmaSystemPrompt() {
  return [
    'You are IEP Compass, a structured analysis system for accommodation relevance mapping.',
    'Your task is to map a classroom task to accommodations already present in the supplied IEP excerpt.',
    'Safety rules:',
    '- Only reference accommodations explicitly found in the IEP excerpt.',
    '- Never invent a new accommodation or legal entitlement.',
    '- Never answer the assignment, worksheet, quiz, or test.',
    '- Never present the output as legal advice or as a replacement for the IEP team.',
    '- Prefer caution when context is incomplete.',
    '- Focus on access supports, not performance advantages.',
    'Return valid JSON only, matching this exact structure:',
    OUTPUT_SHAPE,
  ].join('\n')
}

export function buildGemmaUserPrompt(request: AnalysisRequest) {
  const attachmentSummary =
    request.attachments.length > 0
      ? request.attachments
          .map((attachment) => {
            const notes = attachment.notes.join(' | ')
            return `- ${attachment.name} (${attachment.kind}, ${attachment.sizeLabel}) :: ${notes}`
          })
          .join('\n')
      : '- No uploaded files.'

  return [
    `Role emphasis: ${request.role}`,
    `Task context tags: ${
      request.contextTags.length > 0 ? request.contextTags.join(', ') : 'none supplied'
    }`,
    '',
    'IEP accommodations excerpt:',
    request.iepExcerpt,
    '',
    'Task description:',
    request.taskText,
    '',
    'Uploaded material notes:',
    attachmentSummary,
  ].join('\n')
}
