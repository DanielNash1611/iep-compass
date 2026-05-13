import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createJordanDemoSources,
  JORDAN_DEMO_EXAMPLE_ID,
} from '../../src/data/demoCase.ts'
import {
  buildEffectiveSourceText,
  buildTaskSourceSummary,
  getPendingReviewAttachments,
} from '../../src/features/source/sourceText.ts'
import {
  serializePersistedIepSource,
} from '../../src/features/source/localSourceStorage.ts'

test('Jordan demo case builds review-ready seeded attachments', () => {
  const demo = createJordanDemoSources()

  assert.equal(demo.taskTitle, 'Character Change Paragraph')
  assert.equal(demo.contextTags.includes('writing'), true)
  assert.equal(demo.iepSource.attachments.length, 1)
  assert.equal(demo.taskSource.attachments.length, 1)

  const iepAttachment = demo.iepSource.attachments[0]
  const taskAttachment = demo.taskSource.attachments[0]

  assert.equal(iepAttachment.isDemoSeed, true)
  assert.equal(iepAttachment.previewUrlIsStatic, true)
  assert.equal(iepAttachment.status, 'review_ready')
  assert.match(iepAttachment.extractedText, /Provide written and verbal directions/)

  assert.equal(taskAttachment.isDemoSeed, true)
  assert.equal(taskAttachment.previewUrlIsStatic, true)
  assert.equal(taskAttachment.status, 'review_ready')
  assert.equal(taskAttachment.documentKind, 'assignment_or_quiz')
  assert.equal(taskAttachment.documentDraft.visibleDocumentType, 'assignment_details')
})

test('Jordan demo sources require review before entering the source trail', () => {
  const demo = createJordanDemoSources()

  assert.equal(buildEffectiveSourceText(demo.iepSource), '')
  assert.deepEqual(
    getPendingReviewAttachments(demo.iepSource.attachments).map((attachment) => attachment.id),
    ['demo-jordan-iep-snapshot'],
  )
  assert.deepEqual(
    getPendingReviewAttachments(demo.taskSource.attachments).map((attachment) => attachment.id),
    ['demo-jordan-task-photo'],
  )
})

test('Jordan demo task draft produces a valid source summary and title context', () => {
  const demo = createJordanDemoSources()
  const taskDraft = demo.taskSource.attachments[0].documentDraft

  assert.match(buildTaskSourceSummary(taskDraft), /Character Change Paragraph|character changes/i)
  assert.match(taskDraft.sourceSummaryText, /Visible document: assignment_details/)
  assert.match(taskDraft.sourceSummaryText, /turn it in by the end of class/)
})

test('seeded IEP upload text is not locally persisted before review', () => {
  const demo = createJordanDemoSources()

  assert.equal(JORDAN_DEMO_EXAMPLE_ID, 'jordan-character-change-demo')
  assert.equal(serializePersistedIepSource(demo.iepSource, demo.learningProfile), null)
})
