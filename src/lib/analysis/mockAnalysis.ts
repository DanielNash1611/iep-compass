import { parseAnalysisResult, type AccommodationConfidence } from '../schema/analysisSchema'
import type { AnalysisRequest } from '../../types/analysis'

interface AccommodationCandidate {
  category: AccommodationCategory
  name: string
  normalized: string
  sourceText: string
}

type AccommodationCategory =
  | 'extended_time'
  | 'chunked_directions'
  | 'reduced_distraction'
  | 'text_to_speech'
  | 'graphic_organizer'
  | 'check_ins'
  | 'other'

const CONFIDENCE_PRIORITY: Record<AccommodationConfidence, number> = {
  likely_relevant: 0,
  possibly_relevant: 1,
  unclear_confirm: 2,
}

const CATEGORY_LABELS: Record<AccommodationCategory, string> = {
  extended_time: 'Extended time',
  chunked_directions: 'Chunked or clarified directions',
  reduced_distraction: 'Reduced-distraction setting',
  text_to_speech: 'Text-to-speech support',
  graphic_organizer: 'Graphic organizer support',
  check_ins: 'Check-ins before or during work',
  other: 'IEP accommodation',
}

const CATEGORY_PATTERNS: Array<{
  category: AccommodationCategory
  pattern: RegExp
}> = [
  { category: 'extended_time', pattern: /(extended time|extra time|additional time|time and a half)/i },
  {
    category: 'chunked_directions',
    pattern:
      /(chunked directions|clarified directions|directions clarified|repeat directions|directions.*smaller steps)/i,
  },
  {
    category: 'reduced_distraction',
    pattern: /(reduced[- ]distraction|small group|quiet setting|separate setting)/i,
  },
  {
    category: 'text_to_speech',
    pattern: /(text-to-speech|read aloud|audio support)/i,
  },
  {
    category: 'graphic_organizer',
    pattern: /(graphic organizer|outline support|planning organizer)/i,
  },
  {
    category: 'check_ins',
    pattern: /(check[- ]ins|teacher check-in|prompting|pre-teach|monitoring)/i,
  },
]

function normalizeText(text: string) {
  return text.toLowerCase()
}

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function detectCategory(sourceText: string): AccommodationCategory {
  const match = CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(sourceText))
  return match?.category ?? 'other'
}

function inferName(sourceText: string, category: AccommodationCategory) {
  if (category !== 'other') {
    return CATEGORY_LABELS[category]
  }

  const cleaned = sourceText
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/^approved accommodations excerpt[:\s-]*/i, '')
    .trim()

  return cleaned.length > 56 ? `${cleaned.slice(0, 53)}...` : cleaned
}

function extractAccommodationCandidates(iepExcerpt: string) {
  const rawLines = iepExcerpt
    .split('\n')
    .flatMap((line) => line.split(/[;•]/))
    .map((line) => line.trim())
    .filter((line) => line.length > 6 && !/approved accommodations excerpt/i.test(line))

  const uniqueLines = Array.from(new Set(rawLines))

  if (uniqueLines.length > 0) {
    return uniqueLines.map<AccommodationCandidate>((sourceText) => {
      const category = detectCategory(sourceText)

      return {
        category,
        name: inferName(sourceText, category),
        normalized: normalizeText(sourceText),
        sourceText,
      }
    })
  }

  const fallbackSentence = iepExcerpt.trim()

  if (!fallbackSentence) {
    return []
  }

  const fallbackCategory = detectCategory(fallbackSentence)

  return [
    {
      category: fallbackCategory,
      name: inferName(fallbackSentence, fallbackCategory),
      normalized: normalizeText(fallbackSentence),
      sourceText: fallbackSentence,
    },
  ]
}

function evaluateCandidate(candidate: AccommodationCandidate, request: AnalysisRequest) {
  const taskText = normalizeText(
    `${request.taskText} ${request.contextTags.join(' ')}`.trim(),
  )

  switch (candidate.category) {
    case 'extended_time': {
      const looksTimed =
        request.contextTags.includes('timed') ||
        request.contextTags.includes('quiz') ||
        includesAny(taskText, [/timed/, /timer/, /quiz/, /test/, /assessment/, /exam/, /\bminutes?\b/])

      if (!looksTimed) {
        return null
      }

      return {
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Confirm the time adjustment before the task begins so expectations stay clear.',
          'Keep the accommodation focused on access to the task, not extra help with answers.',
        ],
        plainLanguage:
          'More time can reduce speed pressure so the student can show what they know without rushing.',
        whyItMayMatter:
          'The task sounds timed or assessment-like, which is when extra time most often matters.',
      }
    }

    case 'chunked_directions': {
      const hasDenseDirections =
        includesAny(taskText, [
          /directions/,
          /multi-step/,
          /steps/,
          /lab/,
          /worksheet/,
          /handout/,
          /word problems?/,
          /prompt/,
        ]) || request.contextTags.includes('lab')

      if (!hasDenseDirections) {
        return null
      }

      return {
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Break directions into shorter chunks before the student gets started.',
          'Pause after each chunk to make sure the next step is clear.',
        ],
        plainLanguage:
          'Smaller chunks can make a dense set of instructions easier to follow without changing the task itself.',
        whyItMayMatter:
          'This task includes multiple steps or dense directions, so clarified directions could support access.',
      }
    }

    case 'reduced_distraction': {
      const needsFocusSupport =
        request.contextTags.includes('timed') ||
        request.contextTags.includes('quiz') ||
        includesAny(taskText, [/quiz/, /test/, /assessment/, /focus/, /quiet/, /independent/])

      if (!needsFocusSupport) {
        return null
      }

      return {
        confidence: 'possibly_relevant' as const,
        implementationNotes: [
          'If the task is high-stakes or attention-heavy, confirm whether a quieter setting is available.',
          'Use this support to reduce distraction, not to change what the student is expected to do.',
        ],
        plainLanguage:
          'A quieter setting can lower distraction during attention-heavy assessments or independent work.',
        whyItMayMatter:
          'The task sounds like an assessment or focused work period where distraction could affect access.',
      }
    }

    case 'text_to_speech': {
      const readingComprehensionTask = includesAny(taskText, [
        /reading comprehension/,
        /reading passage/,
        /ela assessment/,
        /literary analysis/,
        /read the passage/,
      ])

      if (readingComprehensionTask) {
        return {
          confidence: 'unclear_confirm' as const,
          implementationNotes: [
            'Confirm what the task is measuring before using audio support on reading-heavy assessments.',
            'If the support applies only to non-reading-comprehension work, staff should verify the boundary first.',
          ],
          plainLanguage:
            'Audio support may help with directions or access, but this task may also measure reading itself.',
          whyItMayMatter:
            'The accommodation is listed in the excerpt, but the task appears to involve reading comprehension, so staff confirmation matters.',
        }
      }

      const likelyHelpful = includesAny(taskText, [
        /science/,
        /math/,
        /lab/,
        /worksheet/,
        /handout/,
        /directions/,
        /non-reading-comprehension/,
      ])

      if (!likelyHelpful) {
        return null
      }

      return {
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Use text-to-speech for directions or content that is not measuring reading comprehension.',
          'Confirm the support before the student begins if the task format is new.',
        ],
        plainLanguage:
          'Audio support can make printed directions or content more accessible when the task is not testing reading itself.',
        whyItMayMatter:
          'The task looks like a non-ELA content activity with reading demands around the directions or handout.',
      }
    }

    case 'graphic_organizer': {
      const needsPlanningSupport =
        request.contextTags.includes('writing') ||
        request.contextTags.includes('lab') ||
        includesAny(taskText, [
          /organize/,
          /outline/,
          /conclusion/,
          /written response/,
          /explain/,
          /compare/,
          /multi-step/,
          /short-answer/,
        ])

      if (!needsPlanningSupport) {
        return null
      }

      return {
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Offer a planning frame or organizer before the student starts writing.',
          'Keep the organizer focused on structure, not on supplying the content of the response.',
        ],
        plainLanguage:
          'An organizer can help the student plan their ideas and keep track of multi-part directions.',
        whyItMayMatter:
          'The task includes writing, planning, or multiple response parts, so a planning tool could support access.',
      }
    }

    case 'check_ins': {
      const longerTask =
        request.contextTags.includes('homework') ||
        request.contextTags.includes('classwork') ||
        request.contextTags.includes('lab') ||
        includesAny(taskText, [/multi-step/, /independent/, /lab/, /project/, /before class/, /on track/])

      if (!longerTask) {
        return null
      }

      return {
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Schedule a quick check-in before independent work starts and again during longer tasks.',
          'Use the check-in to confirm understanding of the next step rather than to answer the work.',
        ],
        plainLanguage:
          'A quick check-in can help the student start independently and catch confusion before it grows.',
        whyItMayMatter:
          'The task has several parts or independent work time, which makes a brief check-in more useful.',
      }
    }

    default: {
      const taskHasEnoughContext = includesAny(taskText, [
        /assignment/,
        /worksheet/,
        /prompt/,
        /quiz/,
        /test/,
        /lab/,
        /task/,
      ])

      if (!taskHasEnoughContext) {
        return null
      }

      return {
        confidence: 'unclear_confirm' as const,
        implementationNotes: [
          'The support is listed in the excerpt, but the task details do not show exactly how it would be used here.',
          'Confirm with staff before assuming it does or does not apply.',
        ],
        plainLanguage:
          'This support is listed in the excerpt, but the current task description is too general to map it confidently.',
        whyItMayMatter:
          'There may be a connection, but the current information is not specific enough to treat it as likely.',
      }
    }
  }
}

function buildNotRelevantReason(candidate: AccommodationCandidate) {
  switch (candidate.category) {
    case 'extended_time':
      return 'The current task description does not clearly show time pressure or a timed setting.'
    case 'chunked_directions':
      return 'The task details do not clearly show dense or multi-step directions yet.'
    case 'reduced_distraction':
      return 'Nothing in the draft clearly points to an assessment or a quiet-setting need yet.'
    case 'text_to_speech':
      return 'The task description does not clearly show a reading-access need outside the task being measured.'
    case 'graphic_organizer':
      return 'The current details do not clearly show planning or structured writing demands.'
    case 'check_ins':
      return 'The task does not obviously require an independent-work check-in from the current description.'
    default:
      return 'This support is in the excerpt, but the current task description does not show a clear connection.'
  }
}

function buildSummary(
  request: AnalysisRequest,
  relevantCount: number,
  topNames: string[],
) {
  const rolePrefix =
    request.role === 'student'
      ? 'For this task, the supports from your excerpt'
      : request.role === 'parent'
        ? 'For this task, the supports from the excerpt'
        : 'For this task, the approved supports in the excerpt'

  if (relevantCount === 0) {
    return `${rolePrefix} do not show a clear match yet. That usually means the task details are still thin or the connection needs staff confirmation.`
  }

  const leadingNames = topNames.slice(0, 2).join(' and ')

  return `${rolePrefix} point most clearly to ${leadingNames}. The result stays cautious about anything that depends on what the task is measuring or what staff still need to confirm.`
}

function buildStudentAdvocacy(topNames: string[]) {
  if (topNames.length === 0) {
    return {
      suggestedScript:
        'I am not sure which support fits this task yet. Can we look at my IEP accommodations and confirm before I start?',
      alternativeScripts: [
        'Can we double-check which of my approved supports applies here before I begin?',
        'I want to make sure I use my approved accommodations the right way for this task.',
      ],
    }
  }

  const topSupport = topNames[0]

  return {
    suggestedScript: `I think my ${topSupport.toLowerCase()} support may matter for this task. Can we confirm it before I start?`,
    alternativeScripts: [
      `My IEP lists ${topSupport.toLowerCase()}. Can we set that up before I begin?`,
      'Can we check which of my approved supports applies here so I can get started the right way?',
    ],
  }
}

export function runDeterministicAnalysis(request: AnalysisRequest) {
  // Safety-sensitive: every cited support must come directly from the pasted IEP excerpt.
  const candidates = extractAccommodationCandidates(request.iepExcerpt)

  const relevantAccommodations = candidates
    .map((candidate) => {
      const evaluation = evaluateCandidate(candidate, request)

      if (!evaluation) {
        return null
      }

      return {
        ...evaluation,
        name: candidate.name,
        sourceText: candidate.sourceText,
      }
    })
    .filter((item) => item !== null)
    .sort(
      (left, right) =>
        CONFIDENCE_PRIORITY[left.confidence] - CONFIDENCE_PRIORITY[right.confidence],
    )

  const relevantSourceTexts = new Set(
    relevantAccommodations.map((item) => item.sourceText),
  )

  const notObviouslyRelevant = candidates
    .filter((candidate) => !relevantSourceTexts.has(candidate.sourceText))
    .map((candidate) => ({
      name: candidate.name,
      reason: buildNotRelevantReason(candidate),
    }))

  const topNames = relevantAccommodations.map((item) => item.name)

  const boundaries = [
    'Only accommodations explicitly found in the uploaded IEP excerpt are listed here.',
    'This guidance supports understanding and self-advocacy. It is not legal advice or a replacement for the IEP team.',
    'This app does not answer the assignment, worksheet, quiz, or test itself.',
  ]

  if (request.attachments.some((attachment) => attachment.status !== 'ready')) {
    boundaries.push(
      'Uploaded images and PDFs are treated as reference materials unless the reviewed text is also provided or a multimodal endpoint is configured.',
    )
  }

  const teacherReminders = relevantAccommodations
    .flatMap((item) => item.implementationNotes)
    .concat(
      relevantAccommodations.some((item) => item.confidence === 'unclear_confirm')
        ? ['At least one support needs staff confirmation before it is treated as active for this task.']
        : [],
    )

  return parseAnalysisResult({
    boundaries,
    notObviouslyRelevant,
    relevantAccommodations,
    studentAdvocacy: buildStudentAdvocacy(topNames),
    summary: buildSummary(request, relevantAccommodations.length, topNames),
    teacherReminders: Array.from(new Set(teacherReminders)),
  })
}
