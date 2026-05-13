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
    'Pre-loaded IEP snapshot and writing assignment photos. Tap Interpret with Gemma 4 on each upload to run the model live.',
  taskText: '',
  taskTitle: 'Character Change Paragraph',
  title: 'Jordan M. writing assignment',
}

// Kept exported as the reviewed-output reference for image evals.
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

// Kept exported as the reviewed-output reference for image evals.
export const jordanDemoTaskDraft = normalizeDocumentDraft({
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

async function loadDemoImageFile(url: string, name: string): Promise<File> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Could not load demo image at ${url} (${response.status})`)
  }

  const blob = await response.blob()

  return new File([blob], name, {
    lastModified: 0,
    type: blob.type || 'image/jpeg',
  })
}

function buildDemoAttachment(
  file: File,
  attachment: Omit<UploadedAttachment, 'file' | 'fileType' | 'isDemoSeed' | 'kind' | 'previewUrlIsStatic'>,
): UploadedAttachment {
  return {
    ...attachment,
    file,
    fileType: file.type || 'image/jpeg',
    isDemoSeed: true,
    kind: 'image',
    previewUrlIsStatic: true,
  }
}

export async function createJordanDemoSources(): Promise<{
  contextTags: TaskContext[]
  iepSource: SourceMaterial
  learningProfile: string
  taskSource: SourceMaterial
  taskTitle: string
}> {
  const [iepFile, taskFile] = await Promise.all([
    loadDemoImageFile(DEMO_IEP_IMAGE_URL, 'Student Accommodation & Modification Snapshot.jpg'),
    loadDemoImageFile(DEMO_TASK_IMAGE_URL, '7th Grade ELA Character Change Paragraph.jpg'),
  ])

  const iepAttachment = buildDemoAttachment(iepFile, {
    id: 'demo-jordan-iep-snapshot',
    name: iepFile.name,
    notes: [
      'Pre-loaded demo image. Tap Interpret with Gemma 4 to run accommodation extraction live.',
    ],
    previewUrl: DEMO_IEP_IMAGE_URL,
    sizeLabel: 'Demo image',
    status: 'interpret_ready',
  })

  const taskAttachment = buildDemoAttachment(taskFile, {
    id: 'demo-jordan-task-photo',
    name: taskFile.name,
    notes: [
      'Pre-loaded demo image. Tap Interpret with Gemma 4 to run task interpretation live.',
    ],
    previewUrl: DEMO_TASK_IMAGE_URL,
    sizeLabel: 'Demo image',
    status: 'interpret_ready',
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
