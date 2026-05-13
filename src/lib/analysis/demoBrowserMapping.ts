import {
  parseAnalysisResult,
  type AccommodationConfidence,
  type AnalysisResult,
} from '../schema/analysisSchema.ts'
import type { AnalysisRequest } from '../../types/analysis.ts'

type DemoAccommodationId =
  | 'written_directions'
  | 'chunked_steps'
  | 'extended_time'
  | 'key_information_copies'
  | 'preferential_seating'
  | 'visual_supports'
  | 'assistive_technology'
  | 'multiple_checks'
  | 'preview_vocabulary'
  | 'alternative_response'
  | 'minimize_copying'
  | 'guided_notes'

interface DemoAccommodationDefinition {
  applicationReason: string
  confidence: AccommodationConfidence
  implementationNotes: string[]
  name: string
  plainLanguage: string
  sourceText: string
  whyItMayMatter: string
}

const DEFAULT_DEMO_SELECTION: DemoAccommodationId[] = [
  'written_directions',
  'chunked_steps',
  'extended_time',
  'visual_supports',
  'assistive_technology',
  'multiple_checks',
  'alternative_response',
]

const DEMO_MODEL_LABEL = 'Gemma 4 E2B'

const DEMO_ACCOMMODATIONS: Record<DemoAccommodationId, DemoAccommodationDefinition> = {
  alternative_response: {
    applicationReason:
      'The paragraph is a writing task with multiple required parts, so staff may consider whether an approved alternate way to show understanding fits the assignment goal.',
    confidence: 'possibly_relevant',
    implementationNotes: [
      'Ask whether the paragraph format is required or whether another approved response format would still show the same character-change understanding.',
      'Keep the focus on showing understanding of the story, not changing the academic target.',
    ],
    name: 'Alternative ways to show understanding',
    plainLanguage:
      'Jordan may be able to show the character-change idea in another approved format if writing volume is the barrier.',
    sourceText:
      'Allow alternative ways to show understanding, including written, oral, visual, and project-based responses.',
    whyItMayMatter:
      'This can separate the comprehension goal from a writing-production barrier when staff agree it still measures the same skill.',
  },
  assistive_technology: {
    applicationReason:
      'The assignment requires reading a story and drafting a paragraph, so text-to-speech, speech-to-text, audiobooks, or dictation may support access without writing the answer for Jordan.',
    confidence: 'possibly_relevant',
    implementationNotes: [
      'Use assistive technology only for access, such as listening to directions or dictating a draft Jordan plans.',
      'Confirm whether the class rules allow speech-to-text or dictation for this paragraph.',
    ],
    name: 'Assistive technology',
    plainLanguage:
      'Jordan may be able to use approved tools like text-to-speech or speech-to-text while still doing the thinking.',
    sourceText:
      'Allow use of assistive technology, including text-to-speech, speech-to-text, audiobooks, and dictation.',
    whyItMayMatter:
      'The support may reduce reading or transcription load while preserving the assignment target: explaining character change with evidence.',
  },
  chunked_steps: {
    applicationReason:
      'The prompt has several required parts: topic sentence, evidence, explanation, closing sentence, sentence count, underlining evidence, and circling transitions.',
    confidence: 'likely_relevant',
    implementationNotes: [
      'Ask for the directions to be broken into a short checklist before writing.',
      'Work through one requirement at a time: plan, evidence, explanation, closing, then final checks.',
    ],
    name: 'Break directions and assignments into smaller steps',
    plainLanguage:
      'Jordan can ask for the paragraph directions to be chunked into a checklist.',
    sourceText: 'Break directions and assignments into smaller steps.',
    whyItMayMatter:
      'Chunking can reduce the load of holding several oral or written directions in mind at once.',
  },
  extended_time: {
    applicationReason:
      'The sheet says to turn the paragraph in by the end of class, but it does not confirm whether that is a firm timed limit.',
    confidence: 'unclear_confirm',
    implementationNotes: [
      'Check whether end-of-class is a strict deadline for everyone or whether approved extra processing/completion time can apply.',
      'If it is timed, ask how Jordan should use the approved extra time without changing the writing goal.',
    ],
    name: 'Extended time to process and complete tasks',
    plainLanguage:
      'Jordan may need more time if the end-of-class deadline functions like a time limit.',
    sourceText: 'Allow extended time to process information and complete tasks.',
    whyItMayMatter:
      'The accommodation may keep the work focused on explaining character change rather than speed of processing and writing.',
  },
  guided_notes: {
    applicationReason:
      'The task is an assignment page rather than a lecture or note-taking activity, so guided notes are not the strongest match.',
    confidence: 'unclear_confirm',
    implementationNotes: [
      'Use this only if the class first gives lecture notes or story notes that Jordan needs to use for the paragraph.',
    ],
    name: 'Guided notes outline',
    plainLanguage:
      'Guided notes might help only if there are class notes tied to the story or paragraph plan.',
    sourceText: 'Allow access to lecture notes or a guided notes outline.',
    whyItMayMatter:
      'A notes outline could reduce copying or organization demands before drafting.',
  },
  key_information_copies: {
    applicationReason:
      'The page includes directions and a checklist that Jordan may need to refer back to while writing.',
    confidence: 'possibly_relevant',
    implementationNotes: [
      'Keep a written copy of the prompt and checklist visible during drafting.',
    ],
    name: 'Written or digital copies of key information',
    plainLanguage:
      'Jordan can keep the assignment directions and checklist available while working.',
    sourceText:
      'Provide written or digital copies of key information, including notes, instructions, vocabulary, and schedules.',
    whyItMayMatter:
      'The support reduces reliance on memory for multi-part instructions.',
  },
  minimize_copying: {
    applicationReason:
      'The visible task is already on paper, so copying from the board is not obviously central unless the teacher adds directions elsewhere.',
    confidence: 'unclear_confirm',
    implementationNotes: [
      'Ask for any added board directions to be provided in writing if the assignment changes during class.',
    ],
    name: 'Minimize copying from the board',
    plainLanguage:
      'This matters if extra directions are only written on the board.',
    sourceText: 'Minimize copying from the board; provide printed or digital copies.',
    whyItMayMatter:
      'It keeps Jordan focused on planning and writing instead of copying directions.',
  },
  multiple_checks: {
    applicationReason:
      'The assignment has several requirements that are easy to miss, so checking understanding before independent work may help.',
    confidence: 'likely_relevant',
    implementationNotes: [
      'Ask the teacher to confirm Jordan understands the prompt and checklist before independent writing starts.',
      'Use written, visual, or modeling checks rather than relying only on oral directions.',
    ],
    name: 'Check for understanding using multiple methods',
    plainLanguage:
      'Jordan can ask the teacher to confirm the directions in more than one way before starting.',
    sourceText:
      'Check for understanding using multiple methods, including written, visual, and modeling.',
    whyItMayMatter:
      'A quick confirmation can prevent Jordan from missing a required paragraph part.',
  },
  preferential_seating: {
    applicationReason:
      'The assignment is independent writing, so seating may matter if noise or traffic makes it harder to process directions and draft.',
    confidence: 'possibly_relevant',
    implementationNotes: [
      'Ask to work near the teacher or away from noisy/high-traffic areas if the classroom environment is interfering.',
    ],
    name: 'Preferential seating away from noise',
    plainLanguage:
      'Jordan may benefit from a quieter spot or proximity to the teacher while writing.',
    sourceText: 'Seat near the teacher and away from noise or high-traffic areas.',
    whyItMayMatter:
      'A calmer location can reduce auditory-processing load during a multi-step writing task.',
  },
  preview_vocabulary: {
    applicationReason:
      'The story-based paragraph may involve key vocabulary or concepts from the short story, but the visible sheet does not list specific vocabulary.',
    confidence: 'possibly_relevant',
    implementationNotes: [
      'Ask whether key story vocabulary or the idea of character change can be previewed before writing.',
    ],
    name: 'Preview vocabulary and key concepts',
    plainLanguage:
      'Jordan may benefit from previewing important story words or the idea of character change.',
    sourceText: 'Preview vocabulary and key concepts.',
    whyItMayMatter:
      'Previewing can make the writing task easier to start without giving away the response.',
  },
  visual_supports: {
    applicationReason:
      'The assignment asks Jordan to organize a paragraph with evidence and explanation, which matches the approved use of graphic organizers and visual supports.',
    confidence: 'likely_relevant',
    implementationNotes: [
      'Ask for or use a simple paragraph organizer with boxes for topic sentence, evidence, explanation, and closing sentence.',
      'Use the checklist on the page as a visual support while drafting.',
    ],
    name: 'Visual supports and graphic organizers',
    plainLanguage:
      'Jordan can use a visual organizer to plan the paragraph before writing.',
    sourceText:
      'Use visual supports such as graphic organizers, charts, timelines, and anchor charts.',
    whyItMayMatter:
      'The organizer can support planning and sequencing without writing the paragraph for Jordan.',
  },
  written_directions: {
    applicationReason:
      'The assignment has visible written directions and a checklist, so keeping those directions available directly supports the task.',
    confidence: 'likely_relevant',
    implementationNotes: [
      'Keep the written assignment page visible while Jordan works.',
      'Ask the teacher to repeat any oral updates in writing.',
    ],
    name: 'Written and verbal directions',
    plainLanguage:
      'Jordan should have the directions in writing and can ask for oral directions to be repeated or written down.',
    sourceText: 'Provide written and verbal directions.',
    whyItMayMatter:
      'Written directions reduce reliance on auditory processing during a multi-step writing task.',
  },
}

const DEMO_ACCOMMODATION_IDS = Object.keys(DEMO_ACCOMMODATIONS) as DemoAccommodationId[]

function isDemoAttachment(attachment: AnalysisRequest['iepSource']['attachments'][number]) {
  return attachment.isDemoSeed && attachment.id.startsWith('demo-jordan-')
}

export function isJordanDemoRequest(request: AnalysisRequest) {
  const attachments = [
    ...request.iepSource.attachments,
    ...request.taskSource.attachments,
  ]

  return (
    attachments.some(isDemoAttachment) &&
    /character change paragraph/i.test(request.taskTitle)
  )
}

function extractJsonish(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fencedMatch ? fencedMatch[1].trim() : content.trim()
}

export function parseSelectedDemoAccommodationIds(
  content: string,
  allowedIds: readonly string[] = DEMO_ACCOMMODATION_IDS,
) {
  const allowed = new Set(allowedIds)
  let parsed: unknown

  try {
    parsed = JSON.parse(extractJsonish(content))
  } catch {
    const matches = content.match(/[a-z_]+/g) ?? []
    return {
      rejectedIds: matches.filter((id) => !allowed.has(id)),
      selectedIds: matches.filter((id) => allowed.has(id)) as DemoAccommodationId[],
    }
  }

  const rawIds = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'relevant' in parsed
      ? (parsed as { relevant?: unknown }).relevant
      : []
  const ids = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === 'string')
    : []

  return {
    rejectedIds: ids.filter((id) => !allowed.has(id)),
    selectedIds: ids.filter((id) => allowed.has(id)) as DemoAccommodationId[],
  }
}

function buildDemoMappingPrompt() {
  return [
    'Return JSON only: {"relevant":["id"]}. Pick IDs that may help this student access the task. Do not invent IDs.',
    'Task: 7th grade ELA paragraph about how the main character changes in "The Scholarship Jacket"; includes topic sentence, evidence, explanation, closing, 6+ sentences, underline evidence, circle transitions, due end of class.',
    'Student need: auditory processing; visual supports, clear language, and extra processing time help.',
    'IDs:',
    'written_directions=written/verbal directions',
    'chunked_steps=break directions/assignment into smaller steps',
    'extended_time=extra time to process/complete',
    'key_information_copies=written/digital copies of instructions/vocab/schedules',
    'preferential_seating=near teacher/away from noise',
    'visual_supports=graphic organizers/charts/timelines',
    'assistive_technology=text-to-speech/speech-to-text/audiobooks/dictation',
    'multiple_checks=check understanding with written/visual/modeling',
    'preview_vocabulary=preview vocabulary/key concepts',
    'alternative_response=written/oral/visual/project ways to show understanding',
    'minimize_copying=avoid board copying',
    'guided_notes=lecture notes/guided notes outline',
  ].join('\n')
}

async function requestBrowserDemoSelection() {
  const [{ bootstrapGemma4Model }, { DEFAULT_MODEL_ASSET_PATH }] = await Promise.all([
    import('../on-device/modelBootstrap.ts'),
    import('../on-device/modelConfig.ts'),
  ])
  const resources = await bootstrapGemma4Model({
    lightMode: true,
    modelAssetPath: DEFAULT_MODEL_ASSET_PATH,
  })

  try {
    await resources.llmInference.setOptions({
      maxTokens: 180,
      randomSeed: 7,
      temperature: 0.1,
      topK: 16,
    })

    const response = await resources.llmInference.generateResponse(
      [
        '<|turn>system',
        'You select only allowed accommodation IDs for IEP Compass. Return JSON only.<turn|>',
        '<|turn>user',
        `${buildDemoMappingPrompt()}<turn|>`,
        '<|turn>model',
      ].join('\n'),
    )

    return parseSelectedDemoAccommodationIds(response)
  } finally {
    resources.dispose()
  }
}

function buildDemoAnalysisResult(selectedIds: DemoAccommodationId[]): AnalysisResult {
  const selectedSet = new Set(selectedIds.length > 0 ? selectedIds : DEFAULT_DEMO_SELECTION)
  const relevantAccommodations = DEMO_ACCOMMODATION_IDS
    .filter((id) => selectedSet.has(id))
    .map((id) => DEMO_ACCOMMODATIONS[id])
  const notObviouslyRelevant = DEMO_ACCOMMODATION_IDS
    .filter((id) => !selectedSet.has(id))
    .map((id) => ({
      name: DEMO_ACCOMMODATIONS[id].name,
      reason:
        id === 'guided_notes' || id === 'minimize_copying'
          ? 'This may apply only if the teacher adds lecture notes or board-only directions beyond the visible assignment page.'
          : 'The reviewed task details did not make this accommodation one of the clearest first matches.',
    }))

  return parseAnalysisResult({
    boundaries: [
      'This is based on the synthetic demo IEP snapshot and assignment image reviewed in the source trail.',
      'IEP Compass does not write the paragraph or decide the final accommodation; it helps identify supports worth confirming.',
      'Listed modifications are kept separate from accommodations and should be used only if the teacher or IEP team has already specified them.',
    ],
    notObviouslyRelevant,
    parentGuidance: {
      coachNotes: [
        'Ask staff to confirm whether the end-of-class deadline should trigger the approved extra-time support.',
        'Keep the request focused on access to directions, planning, and response format rather than changing the character-change writing goal.',
      ],
      summary:
        'The strongest matches are supports that keep the multi-step writing directions visible, organized, and easier to process.',
    },
    relevantAccommodations,
    studentGuidance: {
      alternativeScripts: [
        'Can I use my paragraph organizer so I can keep the topic sentence, evidence, explanation, and closing in order?',
        'Can you check that I understand all the directions before I start writing?',
      ],
      startHere:
        'Start by asking for the directions to stay visible and for the paragraph steps to be broken into a checklist.',
      suggestedScript:
        'Can I use my accommodations for this paragraph? A checklist or graphic organizer would help me keep track of the evidence, explanation, and final checks.',
    },
    teacherGuidance: {
      staffNotes: [
        'Provide or confirm written directions before independent work begins.',
        'Offer a graphic organizer or checklist without supplying paragraph content.',
        'Clarify whether the end-of-class deadline is flexible under Jordan’s approved time accommodation.',
      ],
      summary:
        'Access supports can help Jordan manage auditory-processing and organization demands while preserving the writing target.',
    },
  })
}

export async function analyzeJordanDemoWithBrowserGemma() {
  try {
    const selection = await requestBrowserDemoSelection()
    const selectedIds =
      selection.selectedIds.length > 0
        ? selection.selectedIds
        : DEFAULT_DEMO_SELECTION

    return {
      notes: [
        `${DEMO_MODEL_LABEL} selected ${selectedIds.length} allowed accommodation IDs from reviewed demo text.`,
        selection.rejectedIds.length > 0
          ? `Ignored model-suggested IDs outside the allowed demo list: ${selection.rejectedIds.join(', ')}.`
          : 'No invented accommodation IDs were accepted.',
      ],
      result: buildDemoAnalysisResult(selectedIds),
      usedFallback: selection.selectedIds.length === 0,
    }
  } catch (error) {
    return {
      notes: [
        `${DEMO_MODEL_LABEL} browser mapping was unavailable, so the demo used the same constrained allowed-ID fallback.`,
        error instanceof Error ? error.message : 'Unknown browser mapping issue.',
      ],
      result: buildDemoAnalysisResult(DEFAULT_DEMO_SELECTION),
      usedFallback: true,
    }
  }
}
