import {
  parseAnalysisResult,
  parseTeacherConcernEvaluation,
  type AnalysisResult,
  type AccommodationConfidence,
} from '../schema/analysisSchema.ts'
import type {
  AnalysisRequest,
  TeacherConcernRequest,
} from '../../types/analysis'

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
  | 'calculator_use'
  | 'graphic_organizer'
  | 'spelling_flexibility'
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
  text_to_speech: 'Text-to-speech accommodation',
  calculator_use: 'Calculator use',
  graphic_organizer: 'Graphic organizer accommodation',
  spelling_flexibility: 'Do not grade spelling when spelling is not the target skill',
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
    category: 'calculator_use',
    pattern: /(use of calculator|calculator( use)?( except| unless| for))/i,
  },
  {
    category: 'graphic_organizer',
    pattern: /(graphic organizer|outline support|planning organizer)/i,
  },
  {
    category: 'spelling_flexibility',
    pattern:
      /(spelling (errors )?(should not|do not|must not).*(grade|count|penalt)|do not grade spelling|spelling is not the skill being measured)/i,
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

function joinWithAnd(items: string[]) {
  if (items.length === 0) {
    return ''
  }

  if (items.length === 1) {
    return items[0]
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function describeWritingTargets(taskText: string) {
  const targets: string[] = []

  if (/idea development/.test(taskText)) {
    targets.push('idea development')
  }
  if (/organization/.test(taskText)) {
    targets.push('organization')
  }
  if (/examples?/.test(taskText)) {
    targets.push('use of examples')
  }
  if (/sentence clarity|clarity/.test(taskText)) {
    targets.push('sentence clarity')
  }
  if (/analysis/.test(taskText)) {
    targets.push('analysis')
  }

  return targets.length > 0 ? joinWithAnd(Array.from(new Set(targets))) : 'the main writing goals'
}

function analyzeSpellingTaskSignals(taskText: string) {
  return {
    contentWritingTargetsListed: includesAny(taskText, [
      /idea development/,
      /organization/,
      /examples?/,
      /sentence clarity|clarity/,
      /analysis/,
    ]),
    spellingForFeedback: includesAny(taskText, [
      /mark spelling mistakes/,
      /mark spelling/,
      /feedback/,
      /revise/,
      /revision/,
      /correct spelling/,
    ]),
    spellingIsMainFocus: includesAny(taskText, [
      /spelling test/,
      /spelling quiz/,
      /edit for spelling/,
      /spelling rubric/,
      /spelling is graded/,
      /grade[sd]? spelling/,
      /measur(?:e|ing)[^.]*spelling/,
      /spelling accuracy is (?:a|the) main/,
      /count off heavily for spelling/,
    ]),
    spellingMentioned: /\bspelling\b/.test(taskText),
    spellingNotMainCategory: includesAny(taskText, [
      /spelling is not listed as a main grading category/,
      /spelling is not a main grading category/,
      /not listed as a main grading category/,
      /not a main grading category/,
      /not the main grading category/,
      /not a primary grading category/,
      /not the primary skill/,
      /not the target skill/,
      /not being measured/,
    ]),
    spellingShownInRubric: includesAny(taskText, [
      /rubric[^.]*spelling/,
      /spelling[^.]*rubric/,
      /focuses on[^.]*spelling/,
      /grading categor(?:y|ies)[^.]*spelling/,
    ]),
    writingTask: includesAny(taskText, [
      /essay/,
      /paragraph/,
      /narrative/,
      /written response/,
      /writing/,
      /draft/,
    ]),
  }
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
    .filter(
      (line) =>
        line.length > 6
        && !/approved accommodations excerpt/i.test(line)
        && !/^(student name|district|dob|meeting date|learning disability or profile wording|modifications)\s*:/i.test(
          line,
        )
        && !/^(setting\s*\/\s*scheduling|teacher directions|student response|self-regulation|organization\s*\/\s*study skills|personal care\s*\/\s*equipment)\s*:?$/i.test(
          line,
        ),
    )

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
    `${request.taskTitle} ${request.taskSource.text} ${request.contextTags.join(' ')}`.trim(),
  )
  const needContext = deriveNeedContext(request.iepSource.text)

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
        applicationReason:
          'The task reads like a timed quiz or assessment, which matches when extra time is usually written to apply.',
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Ask before the task starts how your extra time will work.',
          'Use the extra time for the same task, not for hints or answer help.',
        ],
        plainLanguage:
          'More time can reduce speed pressure so the student can show what they know without rushing.',
        whyItMayMatter:
          needContext.includes('processing')
            ? 'Extra time can offset processing demands so the grade reflects understanding rather than speed under pressure.'
            : 'Extra time can keep speed from becoming the barrier when the goal is to measure what the student knows.',
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
        applicationReason:
          'The task includes several directions or multiple steps, which matches the type of task where chunked directions are typically used.',
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Ask if the directions can be broken into smaller parts.',
          'Check each part before moving to the next step.',
        ],
        plainLanguage:
          'Smaller chunks can make a dense set of instructions easier to follow without changing the task itself.',
        whyItMayMatter:
          needContext.includes('auditory')
            ? 'Breaking directions into smaller pieces can reduce auditory load and make it easier to hold each step accurately.'
            : 'Breaking directions into smaller pieces can reduce overload and help the student access the task expectations clearly.',
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
        applicationReason:
          'The task sounds like focused work or an assessment setting, which is when a lower-distraction environment is most often considered.',
        confidence: 'possibly_relevant' as const,
        implementationNotes: [
          'Ask if there is a quieter place if the room feels distracting.',
          'This accommodation changes the setting, not the work you are expected to do.',
        ],
        plainLanguage:
          'A quieter setting can lower distraction during attention-heavy assessments or independent work.',
        whyItMayMatter:
          'Reducing distraction can help the student show their actual understanding instead of being derailed by the environment.',
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
          applicationReason:
            'The IEP lists an audio accommodation, but this task appears to measure reading itself, so that boundary needs confirmation first.',
          confidence: 'unclear_confirm' as const,
          implementationNotes: [
            'Ask what skill this task is measuring before using the audio accommodation here.',
            'If the audio accommodation is only for non-reading tasks, check that boundary first.',
          ],
          plainLanguage:
            'The audio accommodation may help with directions or access, but this task may also measure reading itself.',
          whyItMayMatter:
            needContext.includes('dyslexia')
              ? 'The audio accommodation may still matter for access, but using it on a reading-comprehension task could change what the assignment is intended to measure.'
              : 'The audio accommodation may still matter for access, but this task could also be measuring reading skill directly.',
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
        applicationReason:
          'The task appears to rely on printed directions or handout text, which matches when a text-to-speech accommodation often applies outside reading-comprehension testing.',
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Ask if audio can be used for the directions or handout text.',
          'Check the setup before you begin if this task format is new.',
        ],
        plainLanguage:
          'An audio accommodation can make printed directions or content more accessible when the task is not testing reading itself.',
        whyItMayMatter:
          needContext.includes('dyslexia') || needContext.includes('auditory')
            ? 'If sound-symbol processing is part of the student profile, the audio accommodation can remove a decoding barrier so the task measures the intended content.'
            : 'The audio accommodation can remove a reading-access barrier when the task is really about the content, not decoding print.',
      }
    }

    case 'calculator_use': {
      const calculatorBlockedByCalculationTest =
        includesAny(candidate.normalized, [
          /except for calculation tests?/,
          /unless .*calculation tests?/,
        ])

      const taskLooksLikeCalculationTest =
        request.taskTraits?.calculationFocus === 'calculation_focused'
        || includesAny(taskText, [
          /calculation test/,
          /math facts/,
          /arithmetic fluency/,
          /compute/,
          /show your calculations/,
        ])

      if (calculatorBlockedByCalculationTest && taskLooksLikeCalculationTest) {
        return {
          applicationReason:
            'The IEP line allows calculator use except on calculation tests, and this task still looks like it may be measuring calculation skill directly.',
          confidence: 'unclear_confirm' as const,
          implementationNotes: [
            'Ask whether this task is being treated as a calculation test before using a calculator.',
            'If the teacher says the task is measuring calculation skill directly, confirm the boundary first.',
          ],
          plainLanguage:
            'Calculator use is listed, but this task may fall inside the calculation-test exception.',
          whyItMayMatter:
            'The accommodation may still apply on many math tasks, but calculation-test boundaries need a quick check before anyone assumes it fits here.',
        }
      }

      const geometryReasoningTask =
        request.taskTraits?.calculationFocus === 'not_calculation_focused'
        || includesAny(taskText, [
          /geometry/,
          /composite figures?/,
          /\barea\b/,
          /perimeter/,
          /diagram/,
          /spatial/,
        ])

      if (!geometryReasoningTask && !/math/.test(taskText)) {
        return null
      }

      return {
        applicationReason:
          geometryReasoningTask
            ? 'The reviewed task details point to geometry or figure-based reasoning work rather than a pure calculation test, which makes the calculator line look more likely to fit.'
            : 'The task still appears math-related, so calculator use may fit depending on whether the teacher considers it a calculation-focused test.',
        confidence: geometryReasoningTask ? 'likely_relevant' as const : 'possibly_relevant' as const,
        implementationNotes: [
          'Ask how calculator use is supposed to work on this specific math task before you begin.',
          'If the teacher says the page is not a calculation test, this accommodation may fit without changing the goal of the work.',
        ],
        plainLanguage:
          'Calculator use may fit here if the page is checking geometry thinking or figure work instead of straight calculation fluency.',
        whyItMayMatter:
          'A calculator can reduce arithmetic load so the task stays focused on the math concept being measured, but the calculation-test boundary still matters.',
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
        applicationReason:
          'The task includes planning or structured writing, which matches when an organizer is commonly used.',
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Ask for the organizer before you start writing.',
          'Use it to plan your ideas, not to fill in the answer for you.',
        ],
        plainLanguage:
          'An organizer can help the student plan their ideas and keep track of multi-part directions.',
        whyItMayMatter:
          'An organizer can separate planning from drafting so the student is graded on ideas and structure rather than losing track of the task demands.',
      }
    }

    case 'spelling_flexibility': {
      const spellingSignals = analyzeSpellingTaskSignals(taskText)
      const writingTargets = describeWritingTargets(taskText)
      const spellingBoundaryIsAmbiguous =
        spellingSignals.spellingMentioned
        && (
          spellingSignals.spellingShownInRubric
          || spellingSignals.spellingForFeedback
          || spellingSignals.spellingNotMainCategory
        )

      if (!spellingSignals.writingTask || spellingSignals.spellingIsMainFocus) {
        return null
      }

      if (spellingBoundaryIsAmbiguous) {
        return {
          applicationReason:
            'This accommodation may be relevant, but spelling is still named in the rubric or task notes, so the source does not fully settle whether spelling is being measured or just marked for feedback.',
          confidence: 'possibly_relevant' as const,
          implementationNotes: [
            'Ask how spelling feedback and grading will work on this task.',
            'Because spelling is mentioned here, check whether it is a main skill being graded or just feedback.',
          ],
          plainLanguage:
            `This accommodation may fit, but since spelling is still mentioned here, staff should check whether spelling is a main grading target or mainly feedback while the grade stays centered on ${writingTargets}.`,
          whyItMayMatter:
            needContext.includes('auditory dyslexia') || needContext.includes('auditory')
              ? `If auditory dyslexia affects sound-to-symbol encoding, heavy spelling penalties may grade that barrier instead of ${writingTargets}. If spelling is only being marked for feedback, this accommodation may help keep those purposes separate.`
              : `If spelling is only being marked for feedback, this accommodation may help keep the grade focused on ${writingTargets} instead of an unrelated spelling barrier.`,
        }
      }

      return {
        applicationReason:
          'The accommodation specifically says spelling should not count when spelling is not the skill being measured, and this task reads like a content-focused writing assignment rather than a spelling assessment.',
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Ask how spelling feedback and grading will work before you turn it in.',
          'This accommodation is about keeping the grade on the main writing goal, not ignoring spelling feedback.',
        ],
        plainLanguage:
          'Spelling can still be corrected, but it should not lower the grade if the assignment is grading ideas, organization, or analysis instead.',
        whyItMayMatter:
          needContext.includes('auditory dyslexia') || needContext.includes('auditory')
            ? 'If auditory dyslexia affects sound-to-symbol encoding, counting spelling heavily on a content essay can grade the disability instead of the student’s ideas and writing thinking.'
            : 'When spelling is not the target skill, removing spelling penalties helps the grade reflect the intended learning goal instead of an unrelated barrier.',
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
        applicationReason:
          'The task includes independent or multi-step work, which matches when check-ins are usually written to apply.',
        confidence: 'likely_relevant' as const,
        implementationNotes: [
          'Ask for a quick check-in before you begin and during longer work.',
          'Use the check-in to make sure the next step is clear, not to get the answer.',
        ],
        plainLanguage:
          'A quick check-in can help the student start independently and catch confusion before it grows.',
        whyItMayMatter:
          'A brief check-in can prevent small misunderstandings from becoming larger access problems once the student is working independently.',
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
        applicationReason:
          'The accommodation is listed in the IEP excerpt, but the current task details are too general to show exactly how it would apply here.',
        confidence: 'unclear_confirm' as const,
        implementationNotes: [
          'The task details do not show exactly how this accommodation would work here yet.',
          'Check with school staff before assuming it does or does not apply.',
        ],
        plainLanguage:
          'This accommodation is listed in the excerpt, but the current task description is too general to map it confidently.',
        whyItMayMatter:
          'There may still be an access reason behind the accommodation, but the current information is not specific enough to explain it responsibly.',
      }
    }
  }
}

function deriveNeedContext(iepText: string) {
  const normalized = normalizeText(iepText)
  const labels: string[] = []

  if (includesAny(normalized, [/auditory dyslexia/])) {
    labels.push('auditory dyslexia')
  }
  if (includesAny(normalized, [/auditory processing/, /auditory/])) {
    labels.push('auditory processing')
  }
  if (includesAny(normalized, [/dyslexia/])) {
    labels.push('dyslexia')
  }
  if (includesAny(normalized, [/processing/])) {
    labels.push('processing')
  }

  return labels.join(', ')
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
    case 'calculator_use':
      return 'The current details do not clearly show whether this math task sits outside a calculation-test boundary.'
    case 'graphic_organizer':
      return 'The current details do not clearly show planning or structured writing demands.'
    case 'spelling_flexibility':
      return 'The task does not clearly show a non-spelling-focused writing grade from the current description.'
    case 'check_ins':
      return 'The task does not obviously require an independent-work check-in from the current description.'
    default:
      return 'This accommodation is in the excerpt, but the current task description does not show a clear connection.'
  }
}

function buildStudentStartHere(relevantCount: number, topNames: string[]) {
  if (relevantCount === 0) {
    return 'Nothing looks like a clear match yet. Add a little more about the task, then check again or ask school staff to help you confirm it.'
  }

  const leadingNames = topNames.slice(0, 2).join(' and ')

  return `Start with ${leadingNames}. These look like the strongest matches for this task. Anything less settled is marked so you know what to double-check.`
}

function buildStudentAdvocacy(topNames: string[]) {
  if (topNames.length === 0) {
    return {
      suggestedScript:
        'I am not sure which accommodation fits this task yet. Can we look at my IEP accommodations and confirm before I start?',
      alternativeScripts: [
        'Can we double-check which of my approved accommodations applies here before I begin?',
        'I want to make sure I use my approved accommodations the right way for this task.',
      ],
    }
  }

  const topSupport = topNames[0]

  return {
    suggestedScript: `I think my ${topSupport.toLowerCase()} accommodation may matter for this task. Can we confirm it before I start?`,
    alternativeScripts: [
      `My IEP lists ${topSupport.toLowerCase()}. Can we set that up before I begin?`,
      'Can we check which of my approved accommodations applies here so I can get started the right way?',
    ],
  }
}

function buildParentGuidance(
  topNames: string[],
  relevantAccommodations: AnalysisResult['relevantAccommodations'],
) {
  const uncertainNames = relevantAccommodations
    .filter((item) => item.confidence !== 'likely_relevant')
    .map((item) => item.name)

  const summary =
    topNames.length === 0
      ? 'If a grown-up is helping, the current task details still look too thin to call. It may help to gather a little more detail before making assumptions.'
      : 'If a grown-up is helping, they can coach the setup while still leaving room for the student to use their own words first.'

  const coachNotes = [
    topNames.length > 0
      ? `Start by helping the student check the setup for ${joinWithAnd(topNames.slice(0, 2))}.`
      : 'Use the IEP wording and the task details together before deciding how to help.',
    'Let the student use the script first if they can, then step in to help with logistics if needed.',
    uncertainNames.length > 0
      ? `For ${joinWithAnd(uncertainNames.slice(0, 2))}, treat it as a check-first item until school staff confirm the boundary.`
      : 'Keep the conversation focused on access to the task, not on making the work easier than intended.',
  ]

  return { coachNotes, summary }
}

function buildTeacherGuidance(
  relevantAccommodations: AnalysisResult['relevantAccommodations'],
) {
  const likelyNames = relevantAccommodations
    .filter((item) => item.confidence === 'likely_relevant')
    .map((item) => item.name)
  const uncertainNames = relevantAccommodations
    .filter((item) => item.confidence !== 'likely_relevant')
    .map((item) => item.name)
  const summary =
    relevantAccommodations.length === 0
      ? 'School staff may need a quick check before any accommodation is treated as active for this task.'
      : 'School staff can use these notes to keep the accommodation aligned with the task, what is being measured, and any setup details that still need confirmation.'

  const staffNotes = [
    likelyNames.length > 0
      ? `${joinWithAnd(likelyNames.slice(0, 2))} appear worth checking early for setup on this task.`
      : 'No accommodation looks clearly settled yet from the current task details.',
    uncertainNames.length > 0
      ? `${joinWithAnd(uncertainNames.slice(0, 2))} still appear boundary-sensitive, so confirmation may be needed before treating them as active.`
      : 'The remaining listed accommodations do not add an extra confirmation flag from the current task details.',
    'Keep the accommodation focused on access to the task, not on giving answers or changing the learning target.',
  ]

  return { staffNotes, summary }
}

function buildTeacherConcernEvaluation(
  request: AnalysisRequest,
  topNames: string[],
) {
  const concern = request.teacherConcern?.trim()

  if (!concern) {
    return null
  }

  const normalizedConcern = normalizeText(concern)
  const normalizedTask = normalizeText(`${request.taskTitle} ${request.taskSource.text}`)
  const hasSpellingAccommodation = topNames.some((name) =>
    /spelling/i.test(name),
  )

  if (
    hasSpellingAccommodation &&
    includesAny(normalizedConcern, [/spelling/, /mark down/, /count off/, /grade/]) &&
    includesAny(normalizedTask, [/essay/, /narrative/, /written response/, /rubric/, /organization/, /ideas/])
  ) {
    const spellingSignals = analyzeSpellingTaskSignals(`${normalizedTask} ${normalizedConcern}`)

    if (spellingSignals.spellingIsMainFocus) {
      return {
        concern,
        guidance:
          'The teacher concern appears reasonable because the available materials suggest spelling may be one of the skills being measured here.',
        suggestedResponse:
          'It may help to confirm whether this task is intentionally measuring spelling accuracy before applying the accommodation.',
        verdict: 'supports_teacher_concern' as const,
      }
    }

    if (
      spellingSignals.spellingShownInRubric
      || spellingSignals.spellingForFeedback
      || spellingSignals.spellingNotMainCategory
    ) {
      return {
        concern,
        guidance:
          'The concern and accommodation point to a real tension: spelling is still named in the rubric or task notes, but the IEP line only applies when spelling is not the skill being measured.',
        suggestedResponse:
          'It may be more consistent to confirm whether spelling is a core skill being graded or whether it is mainly being marked for feedback and revision before treating the accommodation as settled.',
        verdict: 'mixed_needs_context' as const,
      }
    }

    return {
      concern,
      guidance:
        'The teacher concern makes sense if the goal is to give feedback on spelling, but the accommodation still appears consistent with not counting those errors toward the grade when spelling is not the target skill.',
      suggestedResponse:
        'It may be more consistent to mark the spelling errors for feedback while keeping the grade focused on the essay rubric categories that are actually being measured.',
      verdict: 'supports_accommodation' as const,
    }
  }

  if (
    includesAny(normalizedConcern, [/reading comprehension/, /measuring reading/, /target skill/]) &&
    includesAny(normalizedTask, [/reading passage/, /reading comprehension/, /ela assessment/])
  ) {
    return {
      concern,
      guidance:
        'The teacher concern appears reasonable because the task may be measuring the same skill that the accommodation could change.',
      suggestedResponse:
        'It may be appropriate to agree with the concern for this task and confirm the boundary with special education staff before applying the accommodation.',
      verdict: 'supports_teacher_concern' as const,
    }
  }

  return {
    concern,
    guidance:
      'The concern is understandable, but the current materials do not fully settle the issue one way or the other.',
    suggestedResponse:
      'Use the cited IEP language and the task rubric together, then confirm with staff if the teacher still has concerns about whether the accommodation changes the skill being measured.',
    verdict: 'mixed_needs_context' as const,
  }
}

export function runTeacherConcernAnalysis(request: TeacherConcernRequest) {
  const topNames = extractAccommodationCandidates(request.iepSource.text)
    .map((candidate) => {
      const evaluation = evaluateCandidate(candidate, request)

      if (!evaluation) {
        return null
      }

      return {
        confidence: evaluation.confidence,
        name: candidate.name,
      }
    })
    .filter((item) => item !== null)
    .sort(
      (left, right) =>
        CONFIDENCE_PRIORITY[left.confidence] - CONFIDENCE_PRIORITY[right.confidence],
    )
    .map((item) => item.name)

  const evaluation = buildTeacherConcernEvaluation(request, topNames)

  if (!evaluation) {
    throw new Error('Teacher concern analysis requires a concern to evaluate.')
  }

  return parseTeacherConcernEvaluation(evaluation)
}

export function runDeterministicAnalysis(request: AnalysisRequest) {
  // Safety-sensitive: every cited accommodation must come directly from the pasted IEP excerpt.
  const candidates = extractAccommodationCandidates(request.iepSource.text)

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

  const attachments = [
    ...request.iepSource.attachments,
    ...request.taskSource.attachments,
  ]

  if (
    attachments.some(
      (attachment) =>
        !attachment.documentDraft?.sourceSummaryText?.trim()
        && !attachment.reviewedText?.trim() &&
        attachment.kind !== 'text',
    )
  ) {
    boundaries.push(
      'Uploaded images and PDFs stay as reference materials unless their reviewed document details are added to the source trail.',
    )
  }

  const studentAdvocacy = buildStudentAdvocacy(topNames)
  const studentStartHere = buildStudentStartHere(relevantAccommodations.length, topNames)
  const parentGuidance = buildParentGuidance(topNames, relevantAccommodations)
  const teacherGuidance = buildTeacherGuidance(relevantAccommodations)

  return parseAnalysisResult({
    boundaries,
    parentGuidance,
    studentGuidance: {
      alternativeScripts: studentAdvocacy.alternativeScripts,
      startHere: studentStartHere,
      suggestedScript: studentAdvocacy.suggestedScript,
    },
    notObviouslyRelevant,
    relevantAccommodations,
    teacherGuidance,
  })
}
