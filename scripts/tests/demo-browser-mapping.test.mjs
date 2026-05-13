import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isJordanDemoRequest,
  parseSelectedDemoAccommodationIds,
} from '../../src/lib/analysis/demoBrowserMapping.ts'
import {
  createJordanDemoSources,
} from '../../src/data/demoCase.ts'

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

test('demo browser mapping accepts only allowed accommodation IDs', () => {
  const parsed = parseSelectedDemoAccommodationIds(JSON.stringify({
    relevant: [
      'written_directions',
      'visual_supports',
      'invented_extra_breaks',
      'extended_time',
    ],
  }))

  assert.deepEqual(parsed.selectedIds, [
    'written_directions',
    'visual_supports',
    'extended_time',
  ])
  assert.deepEqual(parsed.rejectedIds, ['invented_extra_breaks'])
})

test('demo browser mapping can recover IDs from non-json text while rejecting inventions', () => {
  const parsed = parseSelectedDemoAccommodationIds(
    'I would pick chunked_steps and multiple_checks, plus imaginary_legal_service.',
  )

  assert.deepEqual(parsed.selectedIds, ['chunked_steps', 'multiple_checks'])
  assert.deepEqual(parsed.rejectedIds, [
    'would',
    'pick',
    'and',
    'plus',
    'imaginary_legal_service',
  ])
})

test('Jordan demo request detection requires seeded demo attachments and the demo task title', async () => {
  installDemoFetchStub()
  try {
    const demo = await createJordanDemoSources()

    assert.equal(
      isJordanDemoRequest({
        contextTags: demo.contextTags,
        iepSource: demo.iepSource,
        learningProfile: demo.learningProfile,
        taskSource: demo.taskSource,
        taskTitle: demo.taskTitle,
        taskTraits: null,
      }),
      true,
    )

    assert.equal(
      isJordanDemoRequest({
        contextTags: demo.contextTags,
        iepSource: {
          attachments: [],
          text: 'Provide written and verbal directions.',
        },
        learningProfile: demo.learningProfile,
        taskSource: demo.taskSource,
        taskTitle: 'Different task',
        taskTraits: null,
      }),
      false,
    )
  } finally {
    restoreFetch()
  }
})
