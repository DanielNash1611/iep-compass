import type {
  AnalysisRequest,
  TeacherConcernRequest,
} from '../../types/analysis'

function extractExcerptLines(text: string) {
  return text
    .split('\n')
    .flatMap((line) => line.split(/[;•]/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/approved accommodations excerpt/i.test(line))
}

function classifyExcerptLines(text: string) {
  const accommodationHints = [
    /(extended time|extra time|additional time)/i,
    /(graphic organizer|outline|story map)/i,
    /(text-to-speech|read aloud|audio support)/i,
    /(check[- ]ins?|teacher check[- ]ins?)/i,
    /(reduced[- ]distraction|small group|quiet setting|separate setting)/i,
    /(directions clarified|chunked directions|smaller steps|directions repeated)/i,
    /(should not lower the grade|do not grade spelling|when spelling is not the skill)/i,
    /\b(allow|provide|offer|use|given|support for|setting for)\b/i,
  ]
  const profileHints = [
    /\bstudent has\b/i,
    /\b(specific learning disability|dyslexia|processing need|processing needs|auditory processing)\b/i,
    /\baffect(s|ed)?\b/i,
    /\bneed(s)? that\b/i,
    /\b(sound-symbol|decoding|fluency|encoding)\b/i,
  ]

  return extractExcerptLines(text).reduce(
    (accumulator, line) => {
      const looksLikeAccommodation = accommodationHints.some((pattern) => pattern.test(line))
      const looksLikeProfile = profileHints.some((pattern) => pattern.test(line))

      if (looksLikeProfile && !looksLikeAccommodation) {
        accumulator.profileContext.push(line)
        return accumulator
      }

      accumulator.accommodationLines.push(line)
      return accumulator
    },
    {
      accommodationLines: [] as string[],
      profileContext: [] as string[],
    },
  )
}

function deriveReasoningReminders(request: AnalysisRequest) {
  const iepText = request.iepSource.text.toLowerCase()
  const taskText = `${request.taskTitle} ${request.taskSource.text} ${request.teacherConcern ?? ''}`.toLowerCase()
  const reminders: string[] = []

  if (
    /(should not lower the grade|do not grade spelling|when spelling is not the skill)/i.test(iepText)
    && /spelling/i.test(taskText)
    && /(rubric|mark spelling|feedback|revise|revision|main grading category|graded)/i.test(taskText)
  ) {
    reminders.push(
      'If spelling is named anywhere in the rubric or task notes, do not treat the accommodation as fully settled. Explicitly say it may apply only if spelling is not a core skill being measured, separate spelling feedback or revision from grade penalties, and recommend staff confirmation when the boundary is ambiguous.',
    )
  }

  if (
    /(auditory dyslexia|sound-symbol encoding)/i.test(iepText)
    && /(essay|narrative|writing|written response|draft)/i.test(taskText)
  ) {
    reminders.push(
      'If spelling flexibility is relevant, explicitly explain that heavy spelling penalties may grade sound-symbol encoding difficulty rather than the writing target skill such as idea development or organization.',
    )
  }

  if (
    /(text-to-speech|read aloud|audio support)/i.test(iepText)
    && /(reading passage|reading comprehension|benchmark|ela assessment)/i.test(taskText)
  ) {
    reminders.push(
      'If audio support is discussed in a reading-from-print task, emphasize that the decoding support versus target-skill boundary may need confirmation rather than fully claiming the support applies.',
    )
  }

  if (
    /(auditory processing|auditory dyslexia)/i.test(iepText)
    && /(multi-step|steps|directions|lab|sequence|handout)/i.test(taskText)
  ) {
    reminders.push(
      'If chunked directions, organizers, or check-ins are relevant, explain that they may reduce auditory load and help the student hold the sequence of steps accurately.',
    )
  }

  if (
    /(processing speed|specific learning disability in math|math calculation)/i.test(iepText)
    && /(timed|timer|minutes|quiz|test|assessment)/i.test(taskText)
  ) {
    reminders.push(
      'If extra time is relevant, explain that it may keep the grade focused on understanding and multi-step reasoning rather than speed alone.',
    )
  }

  return reminders
}

function summarizeAttachments(requestSource: AnalysisRequest['iepSource']) {
  return requestSource.attachments.length > 0
    ? requestSource.attachments
        .map((attachment) => {
          const notes = attachment.notes.join(' | ')
          return `- ${attachment.name} (${attachment.kind}, ${attachment.sizeLabel}) :: ${notes}`
        })
        .join('\n')
    : '- No uploaded files.'
}

export const GEMMA_LOCAL_MODEL_ID = 'gemma4:e2b'
export const GEMMA_LOCAL_MODEL_LABEL = 'Gemma 4 E2B'

const OUTPUT_SHAPE = `{
  "summary": "string",
  "relevantAccommodations": [
    {
      "name": "string",
      "sourceText": "string",
      "plainLanguage": "string",
      "applicationReason": "string",
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
  "teacherConcernEvaluation": {
    "concern": "string",
    "verdict": "supports_teacher_concern | supports_accommodation | mixed_needs_context",
    "guidance": "string",
    "suggestedResponse": "string"
  } | null,
  "teacherReminders": ["string"],
  "boundaries": ["string"]
}`

const TEACHER_CONCERN_OUTPUT_SHAPE = `{
  "concern": "string",
  "verdict": "supports_teacher_concern | supports_accommodation | mixed_needs_context",
  "guidance": "string",
  "suggestedResponse": "string"
}`

export function buildGemmaSystemPrompt() {
  return [
    'You are IEP Compass, a structured analysis system for accommodation relevance mapping.',
    'Your task is to map a classroom task to accommodations already present in the supplied IEP excerpt.',
    'For each relevant accommodation, explain both why it appears to apply to this task and why it matters for access when possible.',
    'If a teacher concern is provided, give a balanced evaluation that can agree with the concern, support the accommodation, or explain that more context is needed.',
    'Interpretation rules:',
    '- Treat disability, diagnosis, and processing-profile statements as context for explanation, not as standalone accommodations, unless the line explicitly grants a support.',
    '- Only place actual supports, permissions, or service conditions into relevantAccommodations or notObviouslyRelevant.',
    '- Do not place profile-only lines into relevantAccommodations or notObviouslyRelevant. Omit them from both arrays.',
    '- If every eligible accommodation line appears relevant, return an empty notObviouslyRelevant array.',
    '- Use notObviouslyRelevant only for clear mismatches. If an accommodation is relevant, possibly relevant, or needs confirmation, do not place it in notObviouslyRelevant.',
    '- Do not repeat the same excerpt line in both relevantAccommodations and notObviouslyRelevant.',
    '- Every relevantAccommodations[*].sourceText and every notObviouslyRelevant[*].name must exactly match one eligible accommodation line.',
    '- Never create a placeholder or explanation-only notObviouslyRelevant item. If there is no eligible unused accommodation line, return [].',
    '- In applicationReason or whyItMayMatter, explicitly connect any named disability or processing need to the task demand and the accommodation mechanism when that context is present in the excerpt.',
    '- Use concrete mechanism language when possible, such as decoding, sound-symbol encoding, reading fluency, processing speed, auditory load, or holding multi-step directions.',
    '- Reuse the specific mechanism words from the excerpt when they are available instead of replacing them with generic language.',
    '- Avoid generic filler explanations about anxiety, confidence, motivation, or support unless the excerpt or task specifically mentions them.',
    '- If the named mechanism could distort the grade or rubric focus, say that directly. For example, explain that the grade should reflect the target skill rather than a disability-related barrier such as sound-symbol encoding difficulty.',
    '- In implementationNotes, describe only how to use the cited accommodation for this task. Do not invent extra supports, tools, or modalities that are not explicitly present in the excerpt.',
    '- Even when confidence is likely_relevant, keep the prose cautious and task-specific. Do not say a support definitely, automatically, or completely applies.',
    '- In summary, applicationReason, whyItMayMatter, and teacherConcernEvaluation, prefer cautious phrasing such as "may fit," "appears relevant," "could help," "seems consistent," or "likely matters."',
    '- Avoid declarative lead-ins such as "This accommodation directly addresses..." or "The grading should focus..." unless you soften them with may/appears/could language.',
    '- If the accommodation says spelling should not lower the grade when spelling is not the skill being measured, and the task or rubric also mentions spelling, do not present the issue as fully settled. Explicitly note that spelling is named in the rubric or task, explain that the accommodation may apply only if spelling is not a core target skill, separate feedback or revision from grade penalties, and recommend staff confirmation when the rubric boundary is ambiguous.',
    '- If spelling appears anywhere in the rubric, teacher notes, or task directions, avoid likely_relevant unless the materials clearly show spelling is only feedback or revision and not part of the grading basis.',
    '- If profile or disability context is present, quote or closely reuse at least one key mechanism phrase from that context in whyItMayMatter or teacherConcernEvaluation.guidance.',
    '- In teacherConcernEvaluation, avoid definitive or legal-sounding phrasing such as "this conflicts," "must," or "I support." Frame the result as preliminary guidance tied to the rubric, target skill, and need for confirmation when appropriate.',
    '- Prefer wording such as "may be inconsistent with the rubric focus" or "appears more consistent with the listed accommodation" instead of "conflicts with this accommodation."',
    '- If teacherConcernEvaluation.verdict is supports_accommodation, the prose must still sound provisional: use words like "appears," "may," "seems consistent," or "likely," and avoid wording like "explicitly settles," "clearly requires," or "should" when it sounds final.',
    '- When a teacher concern is present and the issue is about grading or what the task measures, default to mixed_needs_context unless the task details strongly anchor the target skill and rubric boundary.',
    '- When a teacher concern is present, make teacherConcernEvaluation.suggestedResponse start exactly with "It may be more consistent to" or "It may help to" rather than a directive.',
    'Strong reasoning patterns to imitate:',
    '- If the excerpt says auditory dyslexia affects sound-symbol encoding in writing, explain that heavy spelling penalties on a content essay may grade the sound-symbol encoding barrier rather than idea development or organization.',
    '- If a writing rubric mentions spelling anywhere, but the task notes suggest spelling may only be marked for feedback or revision, say the accommodation may be relevant, explicitly surface that tension, and recommend confirming whether spelling is a primary measured skill.',
    '- If the excerpt names processing speed and the task is timed, explain that extra time may help the grade reflect understanding rather than speed alone.',
    '- If the excerpt allows text-to-speech only for non-reading-comprehension tasks and the task appears to measure reading from print, say that boundary needs confirmation instead of fully claiming the support applies.',
    '- If a teacher concern is reasonable but not fully settled, use wording such as "appears consistent," "may be appropriate," or "needs confirmation," rather than absolute conclusions.',
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
  const excerptSummary = classifyExcerptLines(request.iepSource.text)
  const reasoningReminders = deriveReasoningReminders(request)

  return [
    `Role emphasis: ${request.role}`,
    `Task title: ${request.taskTitle || 'Untitled task'}`,
    `Task context tags: ${
      request.contextTags.length > 0 ? request.contextTags.join(', ') : 'none supplied'
    }`,
    '',
    'Full IEP excerpt (this may contain both actual accommodations and profile context):',
    request.iepSource.text,
    '',
    'Eligible accommodation lines for relevantAccommodations and notObviouslyRelevant:',
    excerptSummary.accommodationLines.length > 0
      ? excerptSummary.accommodationLines.map((line) => `- ${line}`).join('\n')
      : '- None detected.',
    'Only these exact lines may be used for relevantAccommodations[*].sourceText and notObviouslyRelevant[*].name.',
    '',
    'Profile or disability context from the excerpt (explanation-only; never place this content in relevantAccommodations or notObviouslyRelevant):',
    excerptSummary.profileContext.length > 0
      ? excerptSummary.profileContext.map((line) => `- ${line}`).join('\n')
      : '- None detected.',
    '',
    'Task-specific reasoning reminders:',
    reasoningReminders.length > 0
      ? reasoningReminders.map((line) => `- ${line}`).join('\n')
      : '- No extra task-specific reminders.',
    '',
    'IEP uploaded material notes:',
    summarizeAttachments(request.iepSource),
    '',
    'Task description:',
    request.taskSource.text,
    '',
    'Teacher concern:',
    request.teacherConcern?.trim() || 'No teacher concern supplied.',
    '',
    'Task uploaded material notes:',
    summarizeAttachments(request.taskSource),
  ].join('\n')
}

export function buildTeacherConcernSystemPrompt() {
  return [
    'You are IEP Compass, a structured follow-up system for addressing a teacher concern about an accommodation.',
    'Your task is to answer the teacher concern using only the supplied IEP excerpt, profile context, and task details.',
    'Evaluate the concern cautiously. You may support the concern, support the accommodation, or explain that more context is needed.',
    'Interpretation rules:',
    '- Treat disability, diagnosis, and processing-profile statements as explanation-only context unless they explicitly grant a support.',
    '- Only rely on accommodations that appear in the supplied eligible accommodation lines.',
    '- Never invent a new accommodation, entitlement, rubric rule, or legal requirement.',
    '- Keep the guidance provisional and grounded in what the task appears to measure.',
    '- Explicitly surface uncertainty when the task target skill or rubric boundary is ambiguous.',
    '- Avoid legal-sounding or absolute language such as "must," "clearly requires," or "this settles the issue."',
    '- Make suggestedResponse start exactly with "It may be more consistent to" or "It may help to".',
    '- Never answer the assignment, worksheet, quiz, or test.',
    'Return valid JSON only, matching this exact structure:',
    TEACHER_CONCERN_OUTPUT_SHAPE,
  ].join('\n')
}

export function buildTeacherConcernUserPrompt(request: TeacherConcernRequest) {
  const excerptSummary = classifyExcerptLines(request.iepSource.text)
  const reasoningReminders = deriveReasoningReminders(request)

  return [
    `Role emphasis: ${request.role}`,
    `Task title: ${request.taskTitle || 'Untitled task'}`,
    `Task context tags: ${
      request.contextTags.length > 0 ? request.contextTags.join(', ') : 'none supplied'
    }`,
    '',
    'Teacher concern to address:',
    request.teacherConcern,
    '',
    'Full IEP excerpt (this may contain both actual accommodations and profile context):',
    request.iepSource.text,
    '',
    'Eligible accommodation lines you may rely on:',
    excerptSummary.accommodationLines.length > 0
      ? excerptSummary.accommodationLines.map((line) => `- ${line}`).join('\n')
      : '- None detected.',
    '',
    'Profile or disability context from the excerpt (explanation-only):',
    excerptSummary.profileContext.length > 0
      ? excerptSummary.profileContext.map((line) => `- ${line}`).join('\n')
      : '- None detected.',
    '',
    'Task-specific reasoning reminders:',
    reasoningReminders.length > 0
      ? reasoningReminders.map((line) => `- ${line}`).join('\n')
      : '- No extra task-specific reminders.',
    '',
    'Task description:',
    request.taskSource.text,
    '',
    'IEP uploaded material notes:',
    summarizeAttachments(request.iepSource),
    '',
    'Task uploaded material notes:',
    summarizeAttachments(request.taskSource),
  ].join('\n')
}
