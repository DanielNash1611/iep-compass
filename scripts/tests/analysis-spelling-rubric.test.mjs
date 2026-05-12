import test from 'node:test'
import assert from 'node:assert/strict'

import { exampleScenarios } from '../../src/data/examples.ts'
import { runDeterministicAnalysis } from '../../src/lib/analysis/mockAnalysis.ts'

function getScenario(id) {
  const scenario = exampleScenarios.find((item) => item.id === id)

  assert.ok(scenario, `Missing example scenario: ${id}`)
  return scenario
}

function toRequest(scenario) {
  return {
    contextTags: scenario.contextTags,
    iepSource: {
      attachments: [],
      text: scenario.iepExcerpt,
    },
    taskSource: {
      attachments: [],
      text: scenario.taskText,
    },
    taskTitle: scenario.taskTitle,
    teacherConcern: scenario.teacherConcern,
  }
}

function getSpellingAccommodation(result) {
  const item = result.relevantAccommodations.find((entry) => /spelling/i.test(entry.name))
  assert.ok(item, 'Expected spelling accommodation to be relevant for this scenario')
  return item
}

function assertStudentFirstGuidance(result) {
  assert.match(result.studentGuidance.startHere || '', /start with|nothing looks like a clear match/i)
  assert.match(result.studentGuidance.suggestedScript || '', /can we|check|my iep/i)
  assert.ok(Array.isArray(result.studentGuidance.alternativeScripts))
  assert.ok(result.studentGuidance.alternativeScripts.length > 0)

  assert.match(result.parentGuidance.summary || '', /grown-up|student|help/i)
  assert.ok(Array.isArray(result.parentGuidance.coachNotes))
  assert.ok(result.parentGuidance.coachNotes.length > 0)

  assert.match(result.teacherGuidance.summary || '', /school staff|support|setup|check/i)
  assert.ok(Array.isArray(result.teacherGuidance.staffNotes))
  assert.ok(result.teacherGuidance.staffNotes.length > 0)
}

test('spelling example keeps the rubric boundary visible in the source fixtures', () => {
  const scenario = getScenario('essay-spelling-accommodation')

  assert.match(scenario.iepExcerpt, /spelling errors should not lower the grade/i)
  assert.match(scenario.iepExcerpt, /auditory dyslexia/i)
  assert.match(scenario.taskText, /rubric focuses on idea development, organization, spelling/i)
  assert.match(scenario.taskText, /spelling is not listed as a main grading category/i)
})

test('deterministic analysis makes spelling-in-rubric cases conditional', () => {
  const request = toRequest(getScenario('essay-spelling-accommodation'))
  const result = runDeterministicAnalysis(request)
  const spelling = getSpellingAccommodation(result)

  assertStudentFirstGuidance(result)
  assert.equal(spelling.confidence, 'possibly_relevant')
  assert.match(spelling.applicationReason, /spelling is still named in the rubric or task notes/i)
  assert.match(spelling.plainLanguage, /may fit/i)
  assert.match(spelling.whyItMayMatter, /sound-to-symbol encoding|sound-symbol encoding/i)
  assert.match(spelling.implementationNotes.join(' '), /spelling feedback and grading/i)
  assert.match(spelling.implementationNotes.join(' '), /main skill being graded|check whether/i)
  assert.match(result.boundaries.join(' '), /Only accommodations explicitly found in the uploaded IEP excerpt are listed here/i)
})

test('deterministic analysis still treats non-rubric spelling cases as more likely relevant', () => {
  const scenario = getScenario('essay-spelling-accommodation')
  const request = toRequest({
    ...scenario,
    taskText:
      'Students are writing a personal narrative essay in class. The rubric focuses on idea development, organization, use of examples, and sentence clarity.',
  })
  const result = runDeterministicAnalysis(request)
  const spelling = getSpellingAccommodation(result)

  assertStudentFirstGuidance(result)
  assert.equal(spelling.confidence, 'likely_relevant')
  assert.match(spelling.plainLanguage, /should not lower the grade|should not count|may fit/i)
})

test('deterministic analysis recognizes no-penalty spelling wording from extracted IEP lines', () => {
  const scenario = getScenario('essay-spelling-accommodation')
  const result = runDeterministicAnalysis(toRequest({
    ...scenario,
    iepExcerpt: `Approved accommodations excerpt:
- No penalty for spelling except on spelling task`,
    taskText:
      'Students are writing a personal narrative paragraph. The rubric focuses on idea development, organization, use of examples, and sentence clarity.',
  }))
  const spelling = getSpellingAccommodation(result)

  assert.equal(spelling.confidence, 'likely_relevant')
  assert.match(spelling.sourceText, /No penalty for spelling/i)
})
