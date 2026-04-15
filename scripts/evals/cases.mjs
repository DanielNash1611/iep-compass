import { exampleScenarios } from '../../src/data/examples.ts'

function getExampleScenario(id) {
  const scenario = exampleScenarios.find((item) => item.id === id)

  if (!scenario) {
    throw new Error(`Missing example scenario: ${id}`)
  }

  return scenario
}

function toRequest(scenario) {
  return {
    contextTags: scenario.contextTags,
    iepSource: {
      attachments: [],
      text: scenario.iepExcerpt,
    },
    role: scenario.role,
    taskSource: {
      attachments: [],
      text: scenario.taskText,
    },
    taskTitle: scenario.taskTitle,
    teacherConcern: scenario.teacherConcern,
  }
}

const essaySpellingScenario = getExampleScenario('essay-spelling-accommodation')

export const evalCases = [
  {
    forbiddenConclusions: [
      'Do not say the accommodation definitely or automatically applies with no caution.',
      'Do not ignore the fact that spelling is named in the rubric.',
      'Do not frame the accommodation as permission to ignore spelling feedback altogether.',
      'Do not say that the rubric mention does not matter unless the output explains why spelling is not actually the target skill being measured.',
    ],
    id: 'essay-spelling-auditory-dyslexia',
    label: 'Spelling flexibility stays balanced, rubric-aware, and disability-specific',
    request: toRequest(essaySpellingScenario),
    requiredJudgementFlags: [
      'measurementBoundaryAddressed',
      'feedbackVsGradingDistinguished',
      'staffConfirmationSuggested',
    ],
    requiredConcepts: [
      'The explanation should connect auditory dyslexia to sound-symbol encoding or spelling in writing.',
      'The response should explicitly acknowledge that spelling is named in the rubric or assignment language.',
      'The response should distinguish spelling being present in the rubric from spelling being a primary target skill that is actually measured.',
      'The response should preserve the boundary that spelling can still be marked for feedback while the grade follows the rubric skill.',
      'The tone should stay cautious and grounded rather than absolute, using conditional language such as may, depends, likely, or staff should confirm.',
    ],
    rubricFocus: [
      'Check whether the output avoids blanket claims that the accommodation fully settles the scenario.',
      'Check whether the output explicitly surfaces the tension created by spelling being named in the rubric.',
      'Check whether the output separates spelling feedback or revision from grading penalties and from the target skill being measured.',
      'Check whether the output recommends staff confirmation when the rubric language remains ambiguous.',
      'Check whether the explanation shows why spelling flexibility matters for auditory dyslexia in this kind of writing task.',
      'Check whether implementation guidance keeps the support about access, not advantage.',
    ],
  },
  {
    forbiddenConclusions: [
      'Do not present the spelling accommodation as fully settled just because spelling is not listed as a main grading category.',
      'Do not smooth over the ambiguity created by spelling appearing in the rubric.',
      'Do not imply that staff confirmation is unnecessary when the rubric language is mixed.',
    ],
    id: 'essay-spelling-rubric-ambiguity',
    label: 'Spelling rubric ambiguity requires explicit conditional framing',
    request: toRequest(essaySpellingScenario),
    requiredJudgementFlags: [
      'measurementBoundaryAddressed',
      'feedbackVsGradingDistinguished',
      'staffConfirmationSuggested',
    ],
    requiredConcepts: [
      'The output should say the accommodation may apply rather than presenting it as fully settled.',
      'The output should explain that spelling may still be marked for feedback or revision without necessarily being a main grading basis.',
      'The output should recommend confirming whether spelling is a core skill being measured or only a feedback point.',
    ],
    rubricFocus: [
      'Check whether the output explicitly names the tension between the rubric mention of spelling and the accommodation condition about what skill is being measured.',
      'Check whether the output uses conditional language instead of polished but overconfident conclusions.',
      'Check whether the output keeps feedback, grading penalties, and target skill separate instead of blending them together.',
    ],
  },
  {
    forbiddenConclusions: [
      'Do not say text-to-speech clearly applies to the reading assessment without surfacing the measurement boundary.',
      'Do not ignore the fact that the task may measure reading from print.',
    ],
    id: 'reading-assessment-boundary',
    label: 'Reading-comprehension boundary prevents overclaiming',
    request: {
      contextTags: ['quiz', 'reading'],
      iepSource: {
        attachments: [],
        text: `Approved accommodations excerpt:
- Extended time for assessments.
- Text-to-speech for non-reading-comprehension tasks only.
- Student has dyslexia that affects decoding and reading fluency.`,
      },
      role: 'teacher',
      taskSource: {
        attachments: [],
        text: `Students will independently read two grade-level passages in class and answer short written questions about main idea and evidence. The benchmark is meant to measure reading comprehension from print within one class period.`,
      },
      taskTitle: 'Reading comprehension benchmark',
      teacherConcern:
        'I am worried that text-to-speech may change what this benchmark is measuring.',
    },
    requiredJudgementFlags: ['measurementBoundaryAddressed', 'staffConfirmationSuggested'],
    requiredConcepts: [
      'The output should acknowledge that extended time may be relevant while text-to-speech needs caution or confirmation.',
      'The explanation should distinguish decoding support from the reading skill the benchmark may be measuring.',
      'The response should use careful language such as may, appears, boundary, or confirm.',
    ],
    rubricFocus: [
      'Check whether the output stays cautious instead of fully claiming that text-to-speech applies.',
      'Check whether the explanation uses the dyslexia information in a concrete way rather than generic disability language.',
      'Check whether the teacher concern evaluation stays balanced about access versus the target skill.',
    ],
  },
  {
    forbiddenConclusions: [
      'Do not describe teacher check-ins as giving hints or answering the lab for the student.',
      'Do not treat chunked directions as generic support with no reference to the auditory-processing need.',
    ],
    id: 'science-lab-auditory-processing',
    label: 'Multi-step lab explanation reflects auditory-processing needs',
    request: {
      contextTags: ['classwork', 'lab'],
      iepSource: {
        attachments: [],
        text: `Approved accommodations excerpt:
- Directions clarified and chunked into smaller steps when tasks are dense.
- Teacher check-ins during multi-step work to confirm the student is on track.
- Student has auditory processing needs that make it hard to hold several spoken directions at once.`,
      },
      role: 'parent',
      taskSource: {
        attachments: [],
        text: `The student is starting a science lab with five spoken steps, a short setup demonstration, and a written conclusion. The class will move quickly once materials are handed out, and the student needs to keep track of the sequence independently.`,
      },
      taskTitle: 'Science lab procedure',
    },
    requiredConcepts: [
      'The explanation should connect chunked directions or check-ins to reducing auditory load and helping the student retain the sequence.',
      'The guidance should describe access support without changing the academic task.',
      'The language should still avoid absolute certainty.',
    ],
    rubricFocus: [
      'Check whether the output ties the explanation to the auditory-processing need in a concrete way.',
      'Check whether the implementation notes preserve independence rather than answer-giving.',
      'Check whether the output stays grounded and cautious even when the support looks likely relevant.',
    ],
  },
  {
    forbiddenConclusions: [
      'Do not say extended time guarantees success or changes the math content.',
      'Do not ignore the specific learning disability and processing-speed information in the IEP excerpt.',
    ],
    id: 'timed-math-processing-speed',
    label: 'Timed quiz explanation connects to processing speed',
    request: {
      contextTags: ['timed', 'quiz'],
      iepSource: {
        attachments: [],
        text: `Approved accommodations excerpt:
- Extended time for quizzes, tests, and timed classroom tasks.
- Student has a specific learning disability in math calculation and processing-speed needs that make it harder to finish multi-step computation under time pressure.`,
      },
      role: 'student',
      taskSource: {
        attachments: [],
        text: `Tomorrow's math quiz is 15 minutes long and includes 10 multi-step decimal and fraction problems. Students have to show their work for each item before time runs out.`,
      },
      taskTitle: 'Timed decimal and fraction quiz',
    },
    requiredConcepts: [
      'The explanation should show that extra time addresses processing-speed pressure so the quiz reflects understanding rather than speed alone.',
      'The explanation should connect the accommodation to the named specific learning disability instead of using generic phrases.',
      'The output should still avoid absolute or guaranteed language.',
    ],
    rubricFocus: [
      'Check whether the explanation is specific about the barrier created by timed multi-step computation.',
      'Check whether the output uses the disability information in a concrete, task-linked way.',
      'Check whether the output stays framed as access support rather than unfair advantage.',
    ],
  },
]
