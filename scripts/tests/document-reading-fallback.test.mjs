import test from 'node:test'
import assert from 'node:assert/strict'

import { recoverBlankTaskDocumentResult } from '../../src/lib/schema/documentReadingRecovery.ts'

test('recoverBlankTaskDocumentResult converts blank unknown task uploads into reviewable task drafts', () => {
  const recovered = recoverBlankTaskDocumentResult(
    {
      confidenceFlags: {
        containsUnclearText: false,
        isPartialDocument: false,
        lowConfidence: false,
      },
      documentKind: 'unknown',
      notes: [],
      rawTranscript: [
        '8-3-8-4 Quiz Practice',
        'Areas of Circles and Composite Figures',
        'Find the area of the circle',
      ].join('\n'),
      reviewDraft: {
        evidenceBullets: [],
        sourceSummaryText: '',
        summary: '',
      },
    },
    '1000007679 (1).jpg',
    'task',
  )

  assert.equal(recovered.documentKind, 'assignment_or_quiz')
  assert.equal(recovered.confidenceFlags.lowConfidence, true)
  assert.match(recovered.reviewDraft.taskDescription, /Quiz Practice/)
  assert.match(recovered.reviewDraft.taskDescription, /Areas of Circles/)
  assert.deepEqual(recovered.reviewDraft.evidenceBullets, [
    '8-3-8-4 Quiz Practice',
    'Areas of Circles and Composite Figures',
    'Find the area of the circle',
  ])
  assert.match(recovered.reviewDraft.followUpQuestions.join(' '), /timed/i)
})

test('recoverBlankTaskDocumentResult leaves nonblank unknown IEP-side drafts unchanged', () => {
  const original = {
    confidenceFlags: {
      containsUnclearText: false,
      isPartialDocument: false,
      lowConfidence: false,
    },
    documentKind: 'unknown',
    notes: [],
    rawTranscript: '',
    reviewDraft: {
      evidenceBullets: ['Visible school header'],
      sourceSummaryText: '',
      summary: 'A school document that needs review.',
    },
  }

  assert.equal(
    recoverBlankTaskDocumentResult(original, 'document.jpg', 'iep'),
    original,
  )
})
