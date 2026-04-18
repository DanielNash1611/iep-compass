import test from 'node:test'
import assert from 'node:assert/strict'

import { parseDocumentReadingResult } from '../../src/lib/schema/ocrSchema.ts'

test('parseDocumentReadingResult normalizes common IEP documentKind aliases', () => {
  const result = parseDocumentReadingResult({
    confidenceFlags: {
      containsUnclearText: false,
      isPartialDocument: false,
      lowConfidence: false,
    },
    documentKind: 'iep',
    notes: [],
    rawTranscript: 'sample',
    reviewDraft: {
      district: '',
      dob: '',
      learningDisabilityOrProfileText: [],
      meetingDate: '',
      modifications: [],
      sections: [],
      sourceSummaryText: '',
      studentName: '',
    },
  })

  assert.equal(result.documentKind, 'iep_accommodations')
})

test('parseDocumentReadingResult infers documentKind from review draft shape when missing', () => {
  const result = parseDocumentReadingResult({
    confidenceFlags: {
      containsUnclearText: false,
      isPartialDocument: false,
      lowConfidence: false,
    },
    notes: [],
    rawTranscript: 'sample',
    reviewDraft: {
      calculationFocus: 'mixed_or_unknown',
      evidenceBullets: [],
      sourceSummaryText: '',
      subject: '',
      taskDescription: 'math quiz practice sheet on geometry',
      timedStatus: 'unknown',
      topic: '',
      workType: 'quiz',
    },
  })

  assert.equal(result.documentKind, 'assignment_or_quiz')
})

test('parseDocumentReadingResult fills safe defaults for partial responses', () => {
  const result = parseDocumentReadingResult({
    documentKind: 'unknown',
    reviewDraft: {},
  })

  assert.deepEqual(result.confidenceFlags, {
    containsUnclearText: false,
    isPartialDocument: false,
    lowConfidence: true,
  })
  assert.deepEqual(result.notes, [])
  assert.equal(result.rawTranscript, '')
  assert.deepEqual(result.reviewDraft.evidenceBullets, [])
  assert.equal(result.reviewDraft.summary, '')
})
