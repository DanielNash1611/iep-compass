import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildEffectiveSourceText,
  getPendingReviewAttachments,
  getReviewedTextAttachments,
  mergeSourceTextBlock,
} from '../../src/features/source/sourceText.ts'

function makeAttachment(overrides = {}) {
  return {
    extractedText: undefined,
    file: new File(['sample'], 'sample.txt', { type: 'text/plain' }),
    fileType: 'text/plain',
    id: 'attachment-1',
    kind: 'text',
    name: 'sample.txt',
    notes: [],
    reviewedText: undefined,
    sizeLabel: '1 KB',
    status: 'text_ready',
    ...overrides,
  }
}

test('buildEffectiveSourceText uses reviewed upload text, not raw extracted text', () => {
  const source = {
    attachments: [
      makeAttachment({
        extractedText: 'Raw OCR text that still needs review',
        id: 'attachment-raw',
        kind: 'image',
        name: 'worksheet.jpg',
        status: 'review_ready',
      }),
      makeAttachment({
        extractedText: 'Reviewed OCR text',
        id: 'attachment-reviewed',
        kind: 'image',
        name: 'worksheet-reviewed.jpg',
        reviewedText: 'Reviewed OCR text',
        status: 'included',
      }),
    ],
    text: 'Typed source text',
  }

  const effectiveText = buildEffectiveSourceText(source)

  assert.match(effectiveText, /Typed source text/)
  assert.match(effectiveText, /Reviewed OCR text/)
  assert.doesNotMatch(effectiveText, /Raw OCR text that still needs review/)
})

test('getReviewedTextAttachments only returns attachments with reviewed text', () => {
  const attachments = [
    makeAttachment({
      extractedText: 'OCR draft',
      id: 'draft',
      kind: 'pdf',
      name: 'iep.pdf',
      status: 'review_ready',
    }),
    makeAttachment({
      extractedText: 'Accepted text',
      id: 'accepted',
      reviewedText: 'Accepted text',
      status: 'included',
    }),
  ]

  const reviewed = getReviewedTextAttachments(attachments)

  assert.equal(reviewed.length, 1)
  assert.equal(reviewed[0].id, 'accepted')
})

test('getPendingReviewAttachments includes image-based IEP text that still needs review', () => {
  const attachments = [
    makeAttachment({
      extractedText: 'Student Information\nStudent Name: Juliette',
      id: 'iep-image',
      kind: 'image',
      name: 'iep-photo.jpg',
      status: 'review_ready',
    }),
    makeAttachment({
      documentDraft: {
        calculationFocus: 'mixed_or_unknown',
        evidenceBullets: [],
        sourceSummaryText: '',
        subject: '',
        taskDescription: 'Solve the worksheet problems.',
        timedStatus: 'unknown',
        topic: '',
        workType: 'worksheet',
      },
      id: 'task-image',
      kind: 'image',
      name: 'assignment-photo.jpg',
      status: 'review_ready',
    }),
    makeAttachment({
      extractedText: 'Already included',
      id: 'included',
      kind: 'image',
      name: 'included.jpg',
      reviewedText: 'Already included',
      status: 'included',
    }),
  ]

  const pending = getPendingReviewAttachments(attachments)

  assert.deepEqual(
    pending.map((attachment) => attachment.id),
    ['iep-image', 'task-image'],
  )
})

test('mergeSourceTextBlock appends reviewed IEP text without duplicating existing blocks', () => {
  const merged = mergeSourceTextBlock(
    'Extended time for quizzes and tests',
    'Reduced-distraction setting for assessments',
  )

  assert.equal(
    merged,
    [
      'Extended time for quizzes and tests',
      'Reduced-distraction setting for assessments',
    ].join('\n\n'),
  )

  assert.equal(
    mergeSourceTextBlock(
      merged,
      'Reduced-distraction setting for assessments',
    ),
    merged,
  )
})
