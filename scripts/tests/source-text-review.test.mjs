import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addMissingSourceTextBlock,
  buildEffectiveSourceText,
  buildTaskSourceSummary,
  getPendingReviewAttachments,
  getReviewedTextAttachments,
  hasUsableSourceText,
  mergeSourceTextBlock,
  replaceSourceTextBlock,
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

test('buildEffectiveSourceText includes reviewed text already applied to the main text box', () => {
  const source = {
    attachments: [
      makeAttachment({
        extractedText: 'Raw OCR text',
        id: 'applied-review',
        kind: 'image',
        name: 'iep-photo.jpg',
        reviewedText: 'Reviewed accommodation wording',
        status: 'applied_to_text',
      }),
    ],
    text: '',
  }

  assert.match(buildEffectiveSourceText(source), /Reviewed accommodation wording/)
  assert.equal(hasUsableSourceText(source), true)
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
        accessRelevantDetails: [],
        accommodationFocus: 'unknown',
        calculationFocus: 'mixed_or_unknown',
        evidenceBullets: [],
        followUpQuestions: [],
        sourceSummaryText: '',
        subject: '',
        taskDescription: 'Solve the worksheet problems.',
        timeLimitMinutes: null,
        timedStatus: 'unknown',
        topic: '',
        visibleDocumentType: 'worksheet',
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

test('buildTaskSourceSummary includes assignment document kind and follow-up questions', () => {
  const summary = buildTaskSourceSummary({
    accessRelevantDetails: [
      'Rubric includes spelling and grammar',
      'The page does not say whether writing time is limited',
    ],
    accommodationFocus: 'assignment',
    calculationFocus: 'mixed_or_unknown',
    evidenceBullets: ['Visible rubric categories include organization and spelling'],
    followUpQuestions: [
      'Is this writing assignment timed?',
      'Does spelling count toward the final score?',
    ],
    sourceSummaryText: '',
    subject: 'ELA',
    taskDescription: 'Write a short essay using the rubric.',
    timeLimitMinutes: null,
    timedStatus: 'unknown',
    topic: 'Ecosystems',
    visibleDocumentType: 'rubric',
    workType: 'classwork',
  })

  assert.match(summary, /Visible document: rubric/)
  assert.match(summary, /Accommodation focus: assignment/)
  assert.match(summary, /Access-relevant visible details/)
  assert.match(summary, /Rubric includes spelling and grammar/)
  assert.match(summary, /Follow-up answers to confirm/)
  assert.match(summary, /Is this writing assignment timed\?/)
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

test('replaceSourceTextBlock swaps a reviewed upload block in approved wording', () => {
  const currentText = [
    'Typed approved accommodation',
    'Raw reviewed upload wording',
  ].join('\n\n')

  assert.equal(
    replaceSourceTextBlock(
      currentText,
      'Raw reviewed upload wording',
      'Formatted reviewed upload wording',
    ),
    [
      'Typed approved accommodation',
      'Formatted reviewed upload wording',
    ].join('\n\n'),
  )
})

test('replaceSourceTextBlock removes a reviewed upload block when kept as reference', () => {
  assert.equal(
    replaceSourceTextBlock(
      [
        'Typed approved accommodation',
        'Reviewed upload wording',
      ].join('\n\n'),
      'Reviewed upload wording',
      '',
    ),
    'Typed approved accommodation',
  )
})

test('addMissingSourceTextBlock adds only new section lines from extracted review text', () => {
  const existingText = [
    'Setting / Scheduling:',
    '- Extended time on tests (2 days)',
  ].join('\n')
  const extractedText = [
    'Setting / Scheduling:',
    '- Extended time on tests (2 days)',
    '- Seat away from distractions/noise',
    '',
    'Student Response:',
    '- Use of calculator except for calculation tests',
  ].join('\n')

  assert.equal(
    addMissingSourceTextBlock(existingText, extractedText),
    [
      existingText,
      [
        'Setting / Scheduling:',
        '- Seat away from distractions/noise',
        '',
        'Student Response:',
        '- Use of calculator except for calculation tests',
      ].join('\n'),
    ].join('\n\n'),
  )
})
