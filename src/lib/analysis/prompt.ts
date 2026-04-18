import type { CoreAnalysisResult } from '../schema/analysisSchema'
import type {
  AnalysisRequest,
  TeacherConcernRequest,
} from '../../types/analysis'

function extractExcerptLines(text: string) {
  return text
    .split('\n')
    .flatMap((line) => line.split(/[;•]/))
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length === 0 || /approved accommodations excerpt/i.test(line)) {
        return false
      }

      return !/^(student name|district|dob|meeting date|learning disability or profile wording|modifications)\s*:/i.test(
        line,
      )
        && !/^(setting\s*\/\s*scheduling|teacher directions|student response|self-regulation|organization\s*\/\s*study skills|personal care\s*\/\s*equipment)\s*:?$/i.test(
          line,
        )
    })
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

function buildTaskReasoningText(
  request: AnalysisRequest,
  options: { includeTeacherConcern?: boolean } = {},
) {
  return [
    request.taskTitle,
    request.taskSource.text,
    request.taskTraits
      ? [
          request.taskTraits.taskDescription,
          request.taskTraits.subject,
          request.taskTraits.workType,
          request.taskTraits.topic,
          request.taskTraits.timedStatus,
          request.taskTraits.calculationFocus,
          ...request.taskTraits.evidenceBullets,
        ].join(' ')
      : '',
    options.includeTeacherConcern ? request.teacherConcern ?? '' : '',
  ]
    .join(' ')
    .toLowerCase()
}

function deriveReasoningReminders(
  request: AnalysisRequest,
  options: { includeTeacherConcern?: boolean } = {},
) {
  const iepText = request.iepSource.text.toLowerCase()
  const taskText = buildTaskReasoningText(request, options)
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
      'If an audio accommodation is discussed in a reading-from-print task, emphasize that the decoding accommodation versus target-skill boundary may need confirmation rather than fully claiming the accommodation applies.',
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

function formatCoreResult(coreResult: CoreAnalysisResult) {
  return [
    'Validated core result (do not contradict, strengthen, or expand beyond this):',
    '',
    'Relevant accommodations:',
    coreResult.relevantAccommodations.length > 0
      ? coreResult.relevantAccommodations
          .map((item) =>
            [
              `- Name: ${item.name}`,
              `  - Source text: ${item.sourceText}`,
              `  - Confidence: ${item.confidence}`,
              `  - Plain language: ${item.plainLanguage}`,
              `  - Why it may apply: ${item.applicationReason}`,
              `  - Why it may matter: ${item.whyItMayMatter}`,
              `  - Student next steps: ${item.implementationNotes.join(' | ') || 'none'}`,
            ].join('\n'),
          )
          .join('\n')
      : '- None identified.',
    '',
    'Not obviously relevant:',
    coreResult.notObviouslyRelevant.length > 0
      ? coreResult.notObviouslyRelevant
          .map((item) => `- ${item.name}: ${item.reason}`)
          .join('\n')
      : '- None.',
    '',
    'Boundaries:',
    coreResult.boundaries.map((item) => `- ${item}`).join('\n'),
  ].join('\n')
}

function buildSharedRequestContext(
  request: AnalysisRequest,
  options: { includeTeacherConcern?: boolean } = {},
) {
  const excerptSummary = classifyExcerptLines(request.iepSource.text)
  const reasoningReminders = deriveReasoningReminders(request, options)

  return [
    `Task title: ${request.taskTitle || 'Untitled task'}`,
    `Task context tags: ${
      request.contextTags.length > 0 ? request.contextTags.join(', ') : 'none supplied'
    }`,
    '',
    'Full IEP excerpt (this may contain both actual accommodations and profile context):',
    request.iepSource.text,
    '',
    'Eligible accommodation lines:',
    excerptSummary.accommodationLines.length > 0
      ? excerptSummary.accommodationLines.map((line) => `- ${line}`).join('\n')
      : '- None detected.',
    '',
    'Profile or disability context from the excerpt (explanation-only unless a line explicitly grants an accommodation):',
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
    'Structured task traits from reviewed uploads:',
    request.taskTraits
      ? [
          `- Task description: ${request.taskTraits.taskDescription || 'not provided'}`,
          `- Subject: ${request.taskTraits.subject || 'unknown'}`,
          `- Work type: ${request.taskTraits.workType}`,
          `- Topic: ${request.taskTraits.topic || 'unknown'}`,
          `- Timed status: ${request.taskTraits.timedStatus}`,
          `- Calculation focus: ${request.taskTraits.calculationFocus}`,
          ...(request.taskTraits.evidenceBullets.length > 0
            ? request.taskTraits.evidenceBullets.map((item) => `- Visible evidence: ${item}`)
            : ['- No extra visible evidence bullets.']),
        ].join('\n')
      : '- No structured task traits were reviewed from uploads.',
    '',
    'Task uploaded material notes:',
    summarizeAttachments(request.taskSource),
  ].join('\n')
}

export const GEMMA_LOCAL_MODEL_ID = 'gemma4:e2b'
export const GEMMA_LOCAL_MODEL_LABEL = 'Gemma 4 E2B'

const CORE_OUTPUT_SHAPE = `{
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
  "boundaries": ["string"]
}`

const STUDENT_GUIDANCE_OUTPUT_SHAPE = `{
  "startHere": "string",
  "suggestedScript": "string",
  "alternativeScripts": ["string"]
}`

const PARENT_GUIDANCE_OUTPUT_SHAPE = `{
  "summary": "string",
  "coachNotes": ["string"]
}`

const TEACHER_GUIDANCE_OUTPUT_SHAPE = `{
  "summary": "string",
  "staffNotes": ["string"]
}`

const TEACHER_CONCERN_OUTPUT_SHAPE = `{
  "concern": "string",
  "verdict": "supports_teacher_concern | supports_accommodation | mixed_needs_context",
  "guidance": "string",
  "suggestedResponse": "string"
}`

export function buildCoreAnalysisSystemPrompt() {
  return [
    'You are IEP Compass, a structured analysis system for accommodation relevance mapping.',
    'Your job is to decide which accommodations from the supplied IEP excerpt may fit this task, which ones are less settled, and which ones do not clearly fit yet.',
    'Return only the shared evidence bundle. Do not write audience-specific summaries or scripts in this pass.',
    'Interpretation rules:',
    '- Treat disability, diagnosis, and processing-profile statements as explanation-only context, not as standalone accommodations, unless the line explicitly grants an accommodation.',
    '- Only place actual accommodations, permissions, or service conditions into relevantAccommodations or notObviouslyRelevant.',
    '- Do not place profile-only lines into relevantAccommodations or notObviouslyRelevant. Omit them from both arrays.',
    '- If every eligible accommodation line appears relevant, return an empty notObviouslyRelevant array.',
    '- Use notObviouslyRelevant only for clear mismatches. If an accommodation is relevant, possibly relevant, or needs confirmation, do not place it in notObviouslyRelevant.',
    '- Do not repeat the same excerpt line in both relevantAccommodations and notObviouslyRelevant.',
    '- Every relevantAccommodations[*].sourceText and every notObviouslyRelevant[*].name must exactly match one eligible accommodation line.',
    '- Never create a placeholder or explanation-only notObviouslyRelevant item. If there is no eligible unused accommodation line, return [].',
    '- In applicationReason or whyItMayMatter, explicitly connect any named disability or processing need to the task demand and the accommodation mechanism when that context is present in the excerpt.',
    '- Use concrete mechanism language when possible, such as decoding, sound-symbol encoding, reading fluency, processing speed, auditory load, or holding multi-step directions.',
    '- Reuse the specific mechanism words from the excerpt when they are available instead of replacing them with generic language.',
    '- Avoid generic filler explanations about anxiety, confidence, motivation, or accommodations unless the excerpt or task specifically mentions them.',
    '- If the named mechanism could distort the grade or rubric focus, say that directly. For example, explain that the grade should reflect the target skill rather than a disability-related barrier such as sound-symbol encoding difficulty.',
    '- implementationNotes must be short student-facing next steps. Use direct second-person phrasing such as "Ask if..." or "Check how..." and keep them focused on setting up access, not getting help with answers.',
    '- In implementationNotes, describe only how to use the cited accommodation for this task. Do not invent extra accommodations, tools, or modalities that are not explicitly present in the excerpt.',
    '- Even when confidence is likely_relevant, keep the prose cautious and task-specific. Do not say an accommodation definitely, automatically, or completely applies.',
    '- In applicationReason and whyItMayMatter, prefer cautious phrasing such as "may fit," "appears relevant," "could help," "seems consistent," or "likely matters."',
    '- Avoid declarative lead-ins such as "This accommodation directly addresses..." unless you soften them with may/appears/could language.',
    '- If the accommodation says spelling should not lower the grade when spelling is not the skill being measured, and the task or rubric also mentions spelling, do not present the issue as fully settled. Explicitly note that spelling is named in the rubric or task, explain that the accommodation may apply only if spelling is not a core target skill, separate feedback or revision from grade penalties, and recommend staff confirmation when the rubric boundary is ambiguous.',
    '- If spelling appears anywhere in the rubric, teacher notes, or task directions, avoid likely_relevant unless the materials clearly show spelling is only feedback or revision and not part of the grading basis.',
    '- If profile or disability context is present, quote or closely reuse at least one key mechanism phrase from that context in whyItMayMatter.',
    'Strong reasoning patterns to imitate:',
    '- If the excerpt says auditory dyslexia affects sound-symbol encoding in writing, explain that heavy spelling penalties on a content essay may grade the sound-symbol encoding barrier rather than idea development or organization.',
    '- If a writing rubric mentions spelling anywhere, but the task notes suggest spelling may only be marked for feedback or revision, say the accommodation may be relevant, explicitly surface that tension, and recommend confirming whether spelling is a primary measured skill.',
    '- If the excerpt names processing speed and the task is timed, explain that extra time may help the grade reflect understanding rather than speed alone.',
    '- If the excerpt allows text-to-speech only for non-reading-comprehension tasks and the task appears to measure reading from print, say that boundary needs confirmation instead of fully claiming the accommodation applies.',
    '- If structured task traits from reviewed uploads suggest a math page is focused on geometry, composite figures, area models, or spatial reasoning rather than arithmetic fluency, you may treat a calculator accommodation with a "not for calculation tests" boundary as likely relevant, but keep the wording cautious and task-specific.',
    '- If no disability or profile wording appears in the reviewed IEP source materials, do not invent or backfill any diagnosis or profile explanation.',
    'Safety rules:',
    '- Only reference accommodations explicitly found in the IEP excerpt.',
    '- Never invent a new accommodation or legal entitlement.',
    '- Never answer the assignment, worksheet, quiz, or test.',
    '- Never present the output as legal advice or as a replacement for the IEP team.',
    '- Prefer caution when context is incomplete.',
    '- Focus on access accommodations, not performance advantages.',
    'Return valid JSON only, matching this exact structure:',
    CORE_OUTPUT_SHAPE,
  ].join('\n')
}

export function buildCoreAnalysisUserPrompt(request: AnalysisRequest) {
  return buildSharedRequestContext(request)
}

export function buildStudentGuidanceSystemPrompt() {
  return [
    'You are IEP Compass writing the student-facing step-3 guidance.',
    'Use only the validated core result and the supplied source materials.',
    'Do not add new accommodations, new evidence, or stronger conclusions than the core result allows.',
    'Write for a middle school student.',
    'Style rules:',
    '- Use direct second-person voice.',
    '- Keep sentences short and plain.',
    '- Prefer everyday school words over formal language.',
    '- Keep the tone calm, respectful, and practical.',
    '- Preserve uncertainty with words like "may", "might", "looks like", or "worth checking."',
    '- Do not sound legal, clinical, or bossy.',
    '- suggestedScript and alternativeScripts should help the student ask for an accommodation respectfully before or during the task.',
    'Return valid JSON only, matching this exact structure:',
    STUDENT_GUIDANCE_OUTPUT_SHAPE,
  ].join('\n')
}

export function buildStudentGuidanceUserPrompt(
  request: AnalysisRequest,
  coreResult: CoreAnalysisResult,
) {
  return [
    buildSharedRequestContext(request),
    '',
    formatCoreResult(coreResult),
    '',
    'Write the student-facing guidance now.',
  ].join('\n')
}

export function buildParentGuidanceSystemPrompt() {
  return [
    'You are IEP Compass writing the parent or guardian sidecar for step 3.',
    'Use only the validated core result and the supplied source materials.',
    'Do not add new accommodations, new evidence, or stronger conclusions than the core result allows.',
    'Keep the student as the main user. This is a secondary accommodation note for a grown-up who may be helping.',
    'Style rules:',
    '- Keep the summary short and practical.',
    '- coachNotes should help a grown-up coach or check logistics without taking over the student’s voice.',
    '- Keep the tone calm, supportive, and non-legal.',
    '- Preserve uncertainty and recommend staff confirmation when the core result is not settled.',
    'Return valid JSON only, matching this exact structure:',
    PARENT_GUIDANCE_OUTPUT_SHAPE,
  ].join('\n')
}

export function buildParentGuidanceUserPrompt(
  request: AnalysisRequest,
  coreResult: CoreAnalysisResult,
) {
  return [
    buildSharedRequestContext(request),
    '',
    formatCoreResult(coreResult),
    '',
    'Write the parent or guardian sidecar now.',
  ].join('\n')
}

export function buildTeacherGuidanceSystemPrompt() {
  return [
    'You are IEP Compass writing the school-staff sidecar for step 3.',
    'Use only the validated core result and the supplied source materials.',
    'Do not add new accommodations, new evidence, or stronger conclusions than the core result allows.',
    'This sidecar is a practical, provisional check list for school staff.',
    'Style rules:',
    '- Keep the summary short, careful, and non-legal.',
    '- staffNotes should stay provisional and tied to setup, boundaries, or confirmation needs.',
    '- Use cautious phrasing such as "may", "appears", "worth checking", or "confirm".',
    '- Do not sound like a directive, compliance finding, or legal conclusion.',
    'Return valid JSON only, matching this exact structure:',
    TEACHER_GUIDANCE_OUTPUT_SHAPE,
  ].join('\n')
}

export function buildTeacherGuidanceUserPrompt(
  request: AnalysisRequest,
  coreResult: CoreAnalysisResult,
) {
  return [
    buildSharedRequestContext(request),
    '',
    formatCoreResult(coreResult),
    '',
    'Write the school-staff sidecar now.',
  ].join('\n')
}

export function buildTeacherConcernSystemPrompt() {
  return [
    'You are IEP Compass, a structured follow-up system for addressing a school-staff question about an accommodation.',
    'Your task is to answer the question using only the supplied IEP excerpt, profile context, and task details.',
    'Evaluate the question cautiously. You may lean toward the concern, lean toward the accommodation, or explain that more context is needed.',
    'Interpretation rules:',
    '- Treat disability, diagnosis, and processing-profile statements as explanation-only context unless they explicitly grant an accommodation.',
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
  return [
    buildSharedRequestContext(request, {
      includeTeacherConcern: true,
    }),
    '',
    'School-staff question to address:',
    request.teacherConcern,
  ].join('\n')
}
