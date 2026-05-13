import type { ExampleScenario } from './examples.ts'
import type { SourceMaterial, TaskContext, UploadedAttachment } from '../types/analysis.ts'
import { normalizeDocumentDraft } from '../features/source/sourceText.ts'

export const JORDAN_DEMO_EXAMPLE_ID = 'jordan-character-change-demo'

const DEMO_IEP_IMAGE_URL = '/demo/jordan-accommodation-snapshot.jpg'
const DEMO_TASK_IMAGE_URL = '/demo/jordan-character-change-paragraph.jpg'

export const jordanDemoScenario: ExampleScenario = {
  contextTags: ['classwork', 'writing'],
  id: JORDAN_DEMO_EXAMPLE_ID,
  iepExcerpt: '',
  summary:
    'Pre-reviewed IEP snapshot and a writing assignment photo, ready to walk through the full flow without a live upload.',
  taskText: '',
  taskTitle: 'Character Change Paragraph',
  title: 'Jordan M. writing assignment',
}

export const jordanDemoReviewedIepText = [
  'Student Accommodation & Modification Snapshot',
  'Student: Jordan M.',
  'Grade: 7',
  'Primary area of need: Auditory Processing Disorder',
  '',
  'Learning profile:',
  '- Jordan benefits from structured routines, visual supports, and clear language.',
  '- Processing auditory information can be challenging, especially in noisy environments or with complex directions and oral information.',
  '- Jordan may need additional time to process, organize thoughts, and complete tasks.',
  '',
  'Classroom accommodations:',
  '- Provide written and verbal directions.',
  '- Break directions and assignments into smaller steps.',
  '- Allow extended time to process information and complete tasks.',
  '- Provide written or digital copies of key information, including notes, instructions, vocabulary, and schedules.',
  '- Seat near the teacher and away from noise or high-traffic areas.',
  '- Use visual supports such as graphic organizers, charts, timelines, and anchor charts.',
  '- Allow use of assistive technology, including text-to-speech, speech-to-text, audiobooks, and dictation.',
  '- Check for understanding using multiple methods, including written, visual, and modeling.',
  '- Preview vocabulary and key concepts.',
  '- Allow alternative ways to show understanding, including written, oral, visual, and project-based responses.',
  '- Minimize copying from the board; provide printed or digital copies.',
  '- Allow access to lecture notes or a guided notes outline.',
  '',
  'Modifications, if applicable:',
  '- Reduce the number of items on a worksheet while maintaining the same skill and standard.',
  '- Modify the length or complexity of reading passages while maintaining grade-level standards.',
  '- Adjust written output expectations, such as shorter responses or reduced volume, while assessing the same skill.',
  '- Provide modified assignments or tests as outlined by the teacher/IEP team.',
  '',
  'Preferences that support independence:',
  '- Jordan prefers accommodations that allow them to work independently.',
  '- Avoid calling attention to processing or reading differences.',
  '- Encouragement and specific feedback help build confidence.',
].join('\n')

const jordanTaskDraft = normalizeDocumentDraft({
  accessRelevantDetails: [
    'The student needs to read the short story "The Scholarship Jacket" and write one paragraph explaining how the main character changes.',
    'The paragraph must include a topic sentence, one piece of evidence, an explanation of how the evidence shows the character changed, and a closing sentence.',
    'Before submitting, the student must check that the paragraph has at least 6 complete sentences, underline the evidence, circle transition words, and turn it in by the end of class.',
  ],
  accommodationFocus: 'assignment',
  calculationFocus: 'not_calculation_focused',
  evidenceBullets: [
    'Visible title: 7th Grade English Language Arts, Assignment: Character Change Paragraph.',
    'Visible directions ask for one paragraph about character change in "The Scholarship Jacket."',
    'Visible checklist includes at least 6 complete sentences, underline evidence, circle transition words, and turn it in by the end of class.',
  ],
  followUpQuestions: [
    'Check whether "turn it in by the end of class" means a firm time limit.',
  ],
  sourceSummaryText: '',
  subject: 'English Language Arts',
  taskDescription:
    'Write one paragraph explaining how the main character changes from the beginning of "The Scholarship Jacket" to the end.',
  timeLimitMinutes: null,
  timedStatus: 'unknown',
  topic: 'Character change in "The Scholarship Jacket"',
  visibleDocumentType: 'assignment_details',
  workType: 'classwork',
})

function createDemoFile(name: string) {
  return new File([], name, {
    lastModified: 0,
    type: 'image/jpeg',
  })
}

function buildDemoAttachment(
  attachment: Omit<UploadedAttachment, 'file' | 'fileType' | 'isDemoSeed' | 'kind' | 'previewUrlIsStatic'>,
): UploadedAttachment {
  return {
    ...attachment,
    file: createDemoFile(attachment.name),
    fileType: 'image/jpeg',
    isDemoSeed: true,
    kind: 'image',
    previewUrlIsStatic: true,
  }
}

export function createJordanDemoSources(): {
  contextTags: TaskContext[]
  iepSource: SourceMaterial
  learningProfile: string
  taskSource: SourceMaterial
  taskTitle: string
} {
  const iepAttachment = buildDemoAttachment({
    extractedText: jordanDemoReviewedIepText,
    id: 'demo-jordan-iep-snapshot',
    name: 'Student Accommodation & Modification Snapshot.jpg',
    notes: [
      'Synthetic sample image for demo only.',
      'Pre-reviewed from the visible sample so the phone demo does not depend on live image upload.',
      'Review this extracted accommodations text before adding it to the source trail.',
    ],
    previewUrl: DEMO_IEP_IMAGE_URL,
    readContainsUnclearText: false,
    readNotes: [
      'Pre-reviewed synthetic sample image. No third-party upload is used for this demo case.',
    ],
    sizeLabel: 'Demo image',
    status: 'review_ready',
  })

  const taskAttachment = buildDemoAttachment({
    confidenceFlags: {
      containsUnclearText: false,
      isPartialDocument: false,
      lowConfidence: false,
    },
    documentDraft: jordanTaskDraft,
    documentKind: 'assignment_or_quiz',
    id: 'demo-jordan-task-photo',
    name: '7th Grade ELA Character Change Paragraph.jpg',
    notes: [
      'Synthetic sample image for demo only.',
      'Pre-reviewed from the visible sample so the phone demo does not depend on live image upload.',
      'Review these task details before using them in the source trail.',
    ],
    previewUrl: DEMO_TASK_IMAGE_URL,
    rawTranscript:
      '7th Grade English Language Arts. Assignment: Character Change Paragraph. Read the short story "The Scholarship Jacket." Then write one paragraph explaining how the main character changes from the beginning of the story to the end. Your paragraph must include a topic sentence, one piece of evidence from the story, an explanation, and a closing sentence. Before you submit: at least 6 complete sentences, underline your evidence, circle your transition words, turn it in by the end of class.',
    readContainsUnclearText: false,
    readNotes: [
      'Pre-reviewed synthetic sample image. No third-party upload is used for this demo case.',
    ],
    sizeLabel: 'Demo image',
    status: 'review_ready',
  })

  return {
    contextTags: [...jordanDemoScenario.contextTags],
    iepSource: {
      attachments: [iepAttachment],
      text: '',
    },
    learningProfile: '',
    taskSource: {
      attachments: [taskAttachment],
      text: '',
    },
    taskTitle: jordanDemoScenario.taskTitle,
  }
}

export function isJordanDemoAttachment(attachment: Pick<UploadedAttachment, 'isDemoSeed' | 'id'>) {
  return Boolean(
    attachment.isDemoSeed &&
    (attachment.id === 'demo-jordan-iep-snapshot' || attachment.id === 'demo-jordan-task-photo'),
  )
}
