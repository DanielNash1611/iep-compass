import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildTaskDocumentResultFromPlainText,
} from '../../src/lib/schema/taskDocumentFromText.ts'

test('buildTaskDocumentResultFromPlainText converts e2b task notes into a reviewable draft', () => {
  const result = buildTaskDocumentResultFromPlainText(
    [
      'Document kind: quiz practice worksheet.',
      'Task summary: Math page about Areas of Circles and Composite Figures.',
      'Access details: Several geometry calculation problems are visible.',
      'Timing: [unclear], confirm whether this is timed and how many minutes.',
      'Follow-up: Should accommodations be checked for the practice page or the quiz?',
    ].join('\n'),
    'quiz-practice.jpg',
  )

  assert.equal(result.documentKind, 'assignment_or_quiz')
  assert.equal(result.reviewDraft.visibleDocumentType, 'quiz')
  assert.equal(result.reviewDraft.workType, 'practice')
  assert.equal(result.reviewDraft.accommodationFocus, 'practice')
  assert.equal(result.reviewDraft.subject, 'Math')
  assert.equal(result.reviewDraft.calculationFocus, 'calculation_focused')
  assert.match(result.reviewDraft.taskDescription, /quiz practice/i)
  assert.match(result.reviewDraft.followUpQuestions.join(' '), /practice work/i)
  assert.equal(result.confidenceFlags.containsUnclearText, true)
})

test('buildTaskDocumentResultFromPlainText fails before blank UI output', () => {
  assert.throws(
    () => buildTaskDocumentResultFromPlainText('', 'blank.jpg'),
    /did not produce any task notes/i,
  )

  assert.throws(
    () =>
      buildTaskDocumentResultFromPlainText(
        'The image is unreadable and does not appear to be schoolwork.',
        'blank.jpg',
      ),
    /could not identify a reviewable assignment/i,
  )
})
