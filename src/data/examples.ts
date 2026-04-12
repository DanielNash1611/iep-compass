import type { Role, TaskContext } from '../types/analysis'

export interface ExampleScenario {
  contextTags: TaskContext[]
  id: string
  iepExcerpt: string
  role: Role
  summary: string
  taskText: string
  title: string
}

export const exampleScenarios: ExampleScenario[] = [
  {
    id: 'timed-math-quiz',
    title: 'Timed math quiz',
    summary:
      'Extended time, chunked directions, and reduced-distraction setting for a fast quiz.',
    role: 'student',
    contextTags: ['timed', 'quiz'],
    iepExcerpt: `Approved accommodations excerpt:
- Extended time for quizzes, tests, and timed classroom tasks.
- Directions clarified and chunked into smaller steps when tasks are dense.
- Reduced-distraction setting for assessments when available.`,
    taskText: `Tomorrow's math quiz is 20 minutes long. There are 12 multi-step word problems on fractions and ratios. The teacher said everyone should start right away and turn it in when the timer ends.`,
  },
  {
    id: 'science-lab-handout',
    title: 'Science lab handout',
    summary:
      'Photo-friendly lab scenario with text-to-speech, graphic organizer, and check-ins.',
    role: 'parent',
    contextTags: ['classwork', 'lab'],
    iepExcerpt: `Approved accommodations excerpt:
- Text-to-speech for non-reading-comprehension tasks.
- Graphic organizer support for planning written responses and labs.
- Teacher check-ins during multi-step work to confirm the student is on track.`,
    taskText: `The student has a science lab handout with five steps, short reading directions, and a written conclusion. The assignment asks the student to organize observations, complete the experiment, and explain what happened at the end.`,
  },
  {
    id: 'ela-assessment',
    title: 'ELA assessment prompt',
    summary:
      'Careful relevance mapping for an assessment without helping answer the prompt.',
    role: 'teacher',
    contextTags: ['quiz', 'reading'],
    iepExcerpt: `Approved accommodations excerpt:
- Extended time for assessments.
- Small-group or reduced-distraction setting when attention demands are high.
- Text-to-speech for non-reading-comprehension tasks only.
- Graphic organizer support before drafting written responses.`,
    taskText: `Students are taking an ELA assessment with a reading passage and a written response prompt. The class has one period to finish reading, planning, and writing. The teacher wants to know which supports may apply without changing what the assessment is measuring.`,
  },
  {
    id: 'mobile-worksheet-photo',
    title: 'Mobile worksheet photo flow',
    summary:
      'A quick phone workflow before class begins, with a photo preview and advocacy language.',
    role: 'student',
    contextTags: ['classwork', 'homework'],
    iepExcerpt: `Approved accommodations excerpt:
- Directions repeated or chunked for new tasks.
- Preferential check-ins before independent work begins.
- Graphic organizer support when a worksheet has multiple written parts.`,
    taskText: `A student takes a photo of a social studies worksheet before class starts. The worksheet has several short-answer boxes, a map to label, and directions spread across the page. The student wants to check what support to ask for before the work begins.`,
  },
]
