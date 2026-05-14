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
    'Synthetic IEP and assignment photos ready for the Ollama backup reader.',
  taskText: '',
  taskTitle: 'Character Change Paragraph',
  title: 'Jordan M. writing assignment',
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
