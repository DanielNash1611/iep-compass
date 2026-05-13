import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createJordanDemoSources,
  jordanDemoReviewedIepText,
  jordanDemoTaskDraft,
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

const DEMO_IMAGE_URLS = new Set([
  '/demo/jordan-accommodation-snapshot.jpg',
  '/demo/jordan-character-change-paragraph.jpg',
])

const originalFetch = globalThis.fetch

function installDemoFetchStub() {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input?.url
    if (!url || !DEMO_IMAGE_URLS.has(url)) {
      throw new Error(`Unexpected demo fetch URL: ${url}`)
    }

    return {
      ok: true,
      status: 200,
      async blob() {
        return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
          type: 'image/jpeg',
        })
      },
    }
  }
}

function restoreFetch() {
  globalThis.fetch = originalFetch
}

test('Jordan demo case loads interpret-ready seeded attachments', async () => {
  installDemoFetchStub()
  try {
    const demo = await createJordanDemoSources()

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
    assert.ok(iepAttachment.file instanceof File)
    assert.ok(iepAttachment.file.size > 0)

    assert.equal(taskAttachment.isDemoSeed, true)
    assert.equal(taskAttachment.previewUrlIsStatic, true)
    assert.equal(taskAttachment.status, 'interpret_ready')
    assert.equal(taskAttachment.documentDraft, undefined)
    assert.ok(taskAttachment.file instanceof File)
    assert.ok(taskAttachment.file.size > 0)
  } finally {
    restoreFetch()
  }
})

test('Jordan demo sources start with empty source trail until Gemma runs', async () => {
  installDemoFetchStub()
  try {
    const demo = await createJordanDemoSources()

    assert.equal(buildEffectiveSourceText(demo.iepSource), '')
    assert.deepEqual(
      getPendingReviewAttachments(demo.iepSource.attachments).map((attachment) => attachment.id),
      [],
    )
    assert.deepEqual(
      getPendingReviewAttachments(demo.taskSource.attachments).map((attachment) => attachment.id),
      [],
    )
  } finally {
    restoreFetch()
  }
})

test('Jordan demo reference text and task draft remain available for image evals', () => {
  assert.match(jordanDemoReviewedIepText, /Provide written and verbal directions/)
  assert.equal(jordanDemoTaskDraft.visibleDocumentType, 'assignment_details')
  assert.match(buildTaskSourceSummary(jordanDemoTaskDraft), /Character Change Paragraph|character changes/i)
  assert.match(jordanDemoTaskDraft.sourceSummaryText, /turn it in by the end of class/)
})

test('seeded IEP demo source is not locally persisted before review', async () => {
  installDemoFetchStub()
  try {
    const demo = await createJordanDemoSources()

    assert.equal(JORDAN_DEMO_EXAMPLE_ID, 'jordan-character-change-demo')
    assert.equal(serializePersistedIepSource(demo.iepSource, demo.learningProfile), null)
  } finally {
    restoreFetch()
  }
})
