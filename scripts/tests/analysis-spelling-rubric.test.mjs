import test from 'node:test'
import assert from 'node:assert/strict'

import { exampleScenarios } from '../../src/data/examples.ts'
import { runDeterministicAnalysis } from '../../src/lib/analysis/mockAnalysis.ts'
import { buildGemmaUserPrompt } from '../../src/lib/analysis/prompt.ts'

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
    role: scenario.role,
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

test('prompt reminder surfaces spelling rubric ambiguity', () => {
  const request = toRequest(getScenario('essay-spelling-accommodation'))
  const prompt = buildGemmaUserPrompt(request)

  assert.match(prompt, /do not treat the accommodation as fully settled/i)
  assert.match(prompt, /separate spelling feedback or revision from grade penalties/i)
  assert.match(prompt, /recommend staff confirmation/i)
})

test('deterministic analysis makes spelling-in-rubric cases conditional', () => {
  const request = toRequest(getScenario('essay-spelling-accommodation'))
  const result = runDeterministicAnalysis(request)
  const spelling = getSpellingAccommodation(result)

  assert.equal(spelling.confidence, 'possibly_relevant')
  assert.match(spelling.applicationReason, /spelling is still named in the rubric or task notes/i)
  assert.match(spelling.plainLanguage, /may fit/i)
  assert.match(spelling.whyItMayMatter, /sound-to-symbol encoding|sound-symbol encoding/i)
  assert.match(spelling.implementationNotes.join(' '), /feedback or revision/i)
  assert.match(spelling.implementationNotes.join(' '), /confirm whether spelling is a core skill/i)

  assert.equal(result.teacherConcernEvaluation?.verdict, 'mixed_needs_context')
  assert.match(result.teacherConcernEvaluation?.guidance || '', /real tension/i)
  assert.match(
    result.teacherConcernEvaluation?.suggestedResponse || '',
    /confirm whether spelling is a core skill being graded/i,
  )
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

  assert.equal(spelling.confidence, 'likely_relevant')
  assert.equal(result.teacherConcernEvaluation?.verdict, 'supports_accommodation')
  assert.match(result.teacherConcernEvaluation?.suggestedResponse || '', /mark the spelling errors for feedback/i)
})
