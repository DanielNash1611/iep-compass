import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createJordanDemoSources,
  getJordanDemoAccommodationCorrection,
  JORDAN_DEMO_EXAMPLE_ID,
} from '../../src/data/demoCase.ts'
import {
  buildEffectiveSourceText,
  getPendingReviewAttachments,
  getAttachmentSourceText,
} from '../../src/features/source/sourceText.ts'
import {
  refreshAttachmentNotes,
} from '../../src/features/upload/fileUtils.ts'
import {
  serializePersistedIepSource,
} from '../../src/features/source/localSourceStorage.ts'

test('Jordan demo case starts with seeded images that still need interpretation', () => {
  const demo = createJordanDemoSources()

  assert.equal(demo.taskTitle, 'Character Change Paragraph')
  assert.equal(demo.contextTags.includes('writing'), true)
  assert.equal(demo.iepSource.attachments.length, 1)
  assert.equal(demo.taskSource.attachments.length, 1)

  const iepAttachment = demo.iepSource.attachments[0]
  const taskAttachment = demo.taskSource.attachments[0]

  assert.equal(iepAttachment.isDemoSeed, true)
  assert.equal(iepAttachment.previewUrlIsStatic, true)
  assert.equal(iepAttachment.status, 'interpret_ready')
  assert.equal(iepAttachment.extractedText, undefined)

  assert.equal(taskAttachment.isDemoSeed, true)
  assert.equal(taskAttachment.previewUrlIsStatic, true)
  assert.equal(taskAttachment.status, 'interpret_ready')
  assert.equal(taskAttachment.documentKind, undefined)
  assert.equal(taskAttachment.documentDraft, undefined)
})

test('Jordan demo sources require interpretation before entering the source trail', () => {
  const demo = createJordanDemoSources()

  assert.equal(buildEffectiveSourceText(demo.iepSource), '')
  assert.deepEqual(getPendingReviewAttachments(demo.iepSource.attachments), [])
  assert.deepEqual(getPendingReviewAttachments(demo.taskSource.attachments), [])
})

test('seeded IEP demo source is not locally persisted before review', async () => {
  const demo = createJordanDemoSources()

  assert.equal(JORDAN_DEMO_EXAMPLE_ID, 'jordan-character-change-demo')
  assert.equal(serializePersistedIepSource(demo.iepSource, demo.learningProfile), null)
})

test('Jordan accommodation correction updates the draft without auto-including source text', () => {
  const demo = createJordanDemoSources()
  const attachment = demo.iepSource.attachments[0]
  const correction = getJordanDemoAccommodationCorrection(attachment.id)

  assert.match(correction?.correctedText ?? '', /extended time/i)

  const nextAttachment = refreshAttachmentNotes({
    ...attachment,
    demoCorrectionSource: 'jordan_accommodation_actual',
    extractedText: correction.correctedText,
    manualEditSummary: correction.manualEditSummary,
    rawDemoOutput: 'Original model draft before correction.',
    readMethod: 'gemma4_image',
    readNotes: ['Demo correction inserted confirmed text from the synthetic Jordan accommodation snapshot.'],
    status: 'review_ready',
  })

  assert.equal(nextAttachment.status, 'review_ready')
  assert.match(nextAttachment.extractedText ?? '', /extended time/i)
  assert.match(nextAttachment.rawDemoOutput ?? '', /Original model draft/i)
  assert.deepEqual(getPendingReviewAttachments([nextAttachment]), [nextAttachment])
  assert.equal(getAttachmentSourceText(nextAttachment), '')
})
