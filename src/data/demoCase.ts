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
    'Synthetic IEP and assignment photos with reviewable fallback text for the video demo.',
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
      'Synthetic sample image for demo only.',
      'Use the Ollama backup action to read this image and create a new review draft.',
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
      'Synthetic sample image for demo only.',
      'Use the Ollama backup action to read this image and create a new review draft.',
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
