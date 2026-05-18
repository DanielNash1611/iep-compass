import type { ExampleScenario } from './examples.ts'
import type { SourceMaterial, TaskContext, UploadedAttachment } from '../types/analysis.ts'

export const JORDAN_DEMO_EXAMPLE_ID = 'jordan-character-change-demo'

const DEMO_IEP_IMAGE_URL = '/demo/jordan-accommodation-snapshot.jpg'
const DEMO_TASK_IMAGE_URL = '/demo/jordan-character-change-paragraph.jpg'

export const jordanDemoScenario: ExampleScenario = {
  contextTags: ['classwork', 'writing'],
  id: JORDAN_DEMO_EXAMPLE_ID,
  iepExcerpt: '',
  summary:
    'Synthetic IEP and assignment photos for the presentation walkthrough.',
  taskText: '',
  taskTitle: 'Character Change Paragraph',
  title: 'Jordan M. writing assignment',
}

const JORDAN_DEMO_IEP_ACTUAL_TEXT = `Student name: Jordan M.
Disability/profile wording:
- Auditory Processing Disorder
- Specific Learning Disability in reading and written expression

Accommodations:
- Provide written and verbal directions.
- Break directions and assignments into smaller steps.
- Allow extended time to process information and complete tasks.
- Provide copies of key information, including instructions, vocabulary, schedules, and teacher notes.
- Seat Jordan near the teacher and away from high-traffic or noisy areas when possible.
- Use visual supports such as graphic organizers, charts, timelines, and anchor charts.
- Permit assistive technology for reading and writing tasks, including text-to-speech, speech-to-text, audiobooks, and dictation.
- Check for understanding using written, visual, or modeled examples.
- Preview vocabulary and key concepts before reading or writing tasks.
- Allow alternative ways to show understanding, such as written, oral, visual, or project-based responses.

Modifications:
- Minimize copying from the board when the same information can be provided in writing.
- Provide guided notes or an outline when lectures are used.`

export function getJordanDemoAccommodationCorrection(attachmentId: string) {
  if (attachmentId === 'demo-jordan-iep-snapshot') {
    return {
      correctedText: JORDAN_DEMO_IEP_ACTUAL_TEXT,
      manualEditSummary: [
        'Inserted the confirmed accommodation text from the synthetic demo snapshot after the first model pass.',
        'Separated accommodations from modifications so the source trail stays easier to review.',
        'Kept the original model draft available for comparison.',
      ],
    }
  }

  return null
}

export interface JordanDemoRecordedRun {
  attachmentId: string
  containsUnclearText: boolean
  documentKind?: 'iep_accommodations'
  elapsedMs: number
  modelLabel: string
  rawOutput: string
  readMethod: 'gemma4_image'
  runtimeLabel: string
}

// Representative recorded local Gemma image-reader output for the demo video.
// These are stand-in transcripts so the demo flows without a live endpoint;
// replace rawOutput and elapsedMs with a real captured run when one is available.
const JORDAN_DEMO_RECORDED_RUNS: JordanDemoRecordedRun[] = [
  {
    attachmentId: 'demo-jordan-iep-snapshot',
    containsUnclearText: true,
    documentKind: 'iep_accommodations',
    elapsedMs: 72000,
    modelLabel: 'Gemma 4 E2B',
    rawOutput: `Student name: Jordan M.
Profile / disability wording: Auditory Processing Disorder; Specific Learning Disability in reading and written expression.

Supports and accommodations:
- Provide written and verbal directions.
- Break directions and assignments into smaller steps.
- Allow extended time to process information and complete tasks.
- Provide copies of key information (instructions, vocabulary, schedules, teacher notes).
- Seat Jordan near the teacher and away from high-traffic or noisy areas when possible.
- Use visual supports such as graphic organizers, charts, timelines, and anchor charts.
- Permit assistive technology for reading and writing, including text-to-speech, speech-to-text, audiobooks, and dictation.
- Check for understanding using written, visual, or modeled examples.
- Preview vocabulary and key concepts before reading or writing tasks.
- Allow alternative ways to show understanding (written, oral, visual, or project-based).
- Minimize copying from the board when the same information can be provided in writing.
- Provide guided notes or an outline when lectures are used.
- [unclear] the last line near the bottom of the page is partly cut off.`,
    readMethod: 'gemma4_image',
    runtimeLabel: 'Local Ollama',
  },
  {
    attachmentId: 'demo-jordan-task-photo',
    containsUnclearText: false,
    elapsedMs: 58000,
    modelLabel: 'Gemma 4 E2B',
    rawOutput: `7th Grade ELA - Writing Assignment
Character Change Paragraph

Story: "The Scholarship Jacket"

Directions:
Write one paragraph that explains how the main character changes from the beginning of the story to the end. Your paragraph should:
- Start with a clear topic sentence that names the character and the change.
- Give at least two pieces of text evidence that show the change.
- Explain how each piece of evidence supports your point.
- End with a concluding sentence.

Length: about 6-8 sentences. Due at the end of class.`,
    readMethod: 'gemma4_image',
    runtimeLabel: 'Local Ollama',
  },
]

export function getJordanDemoRecordedRun(
  attachmentId: string,
): JordanDemoRecordedRun | null {
  return (
    JORDAN_DEMO_RECORDED_RUNS.find((run) => run.attachmentId === attachmentId) ?? null
  )
}

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
    id: 'demo-jordan-iep-snapshot',
    name: 'Student Accommodation & Modification Snapshot.jpg',
    notes: [
      'Synthetic sample image for the presentation walkthrough.',
      'Use the local Gemma image reader to create a new review draft.',
      'No hidden accommodation text is included when the sample loads.',
    ],
    previewUrl: DEMO_IEP_IMAGE_URL,
    sizeLabel: 'Demo image',
    status: 'interpret_ready',
  })

  const taskAttachment = buildDemoAttachment({
    id: 'demo-jordan-task-photo',
    name: '7th Grade ELA Character Change Paragraph.jpg',
    notes: [
      'Synthetic sample image for the presentation walkthrough.',
      'Use the local Gemma image reader to create a new review draft.',
      'No hidden task draft is included when the sample loads.',
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
