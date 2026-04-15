import type { Role, TaskContext } from '../types/analysis'

export interface ExampleScenario {
  contextTags: TaskContext[]
  id: string
  iepExcerpt: string
  role: Role
  summary: string
  taskTitle: string
  teacherConcern?: string
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
    taskTitle: 'Fractions and ratios quiz',
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
    taskTitle: 'Science lab handout',
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
    taskTitle: 'ELA assessment prompt',
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
    taskTitle: 'Social studies worksheet',
    iepExcerpt: `Approved accommodations excerpt:
- Directions repeated or chunked for new tasks.
- Preferential check-ins before independent work begins.
- Graphic organizer support when a worksheet has multiple written parts.`,
    taskText: `A student takes a photo of a social studies worksheet before class starts. The worksheet has several short-answer boxes, a map to label, and directions spread across the page. The student wants to check what support to ask for before the work begins.`,
  },
  {
    id: 'essay-spelling-accommodation',
    title: 'Essay with spelling accommodation',
    summary:
      'Balanced review for a writing assignment where spelling appears in the rubric but may still function as feedback rather than a main grading target.',
    role: 'teacher',
    contextTags: ['classwork', 'writing'],
    taskTitle: 'Personal narrative essay',
    teacherConcern:
      'The teacher wants to mark down spelling heavily because the essay has several spelling mistakes.',
    iepExcerpt: `Approved accommodations excerpt:
- Spelling errors should not lower the grade when spelling is not the skill being measured.
- Student has auditory dyslexia and related auditory processing needs that affect sound-symbol encoding in writing.
- Graphic organizer support before drafting written responses.`,
    taskText: `Students are writing a personal narrative essay in class. The rubric focuses on idea development, organization, spelling, use of examples, and sentence clarity. The teacher will still mark spelling mistakes so the student can revise them, but spelling is not listed as a main grading category.`,
  },
]
