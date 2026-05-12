import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deserializePersistedIepDetails,
  deserializePersistedIepSource,
  loadPersistedIepDetails,
  loadPersistedIepSource,
  persistIepSource,
  serializePersistedIepSource,
} from '../../src/features/source/localSourceStorage.ts'

const IEP_SOURCE_STORAGE_KEY = 'iep-compass:iep-source'

function createLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed))

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
  }
}

function withMockWindow(localStorage, callback) {
  const originalWindow = globalThis.window

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  })

  try {
    callback()
  } finally {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
      return
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  }
}

test('serializePersistedIepSource stores versioned text only when content is present', () => {
  const serialized = serializePersistedIepSource({
    text: 'Extended time for quizzes and tests',
  }, 'Auditory dyslexia affects encoding.')

  assert.deepEqual(JSON.parse(serialized), {
    learningProfile: 'Auditory dyslexia affects encoding.',
    text: 'Extended time for quizzes and tests',
    version: 2,
  })

  assert.deepEqual(JSON.parse(serializePersistedIepSource({ text: '' }, 'Profile note')), {
    learningProfile: 'Profile note',
    text: '',
    version: 2,
  })
  assert.equal(serializePersistedIepSource({ text: '   ' }, '   '), null)
})

test('deserializePersistedIepSource ignores invalid payloads', () => {
  assert.equal(deserializePersistedIepSource(null), null)
  assert.equal(deserializePersistedIepSource('not-json'), null)
  assert.equal(
    deserializePersistedIepSource(JSON.stringify({ text: 'Saved text', version: 3 })),
    null,
  )
})

test('deserializePersistedIepDetails restores legacy text and v2 profile notes', () => {
  assert.deepEqual(
    deserializePersistedIepDetails(JSON.stringify({
      text: 'Legacy accommodation text',
      version: 1,
    })),
    {
      learningProfile: '',
      source: {
        attachments: [],
        text: 'Legacy accommodation text',
      },
    },
  )

  assert.deepEqual(
    deserializePersistedIepDetails(JSON.stringify({
      learningProfile: 'Auditory dyslexia affects encoding.',
      text: 'Extended time',
      version: 2,
    })),
    {
      learningProfile: 'Auditory dyslexia affects encoding.',
      source: {
        attachments: [],
        text: 'Extended time',
      },
    },
  )
})

test('loadPersistedIepSource returns a blank-safe source and clears corrupt local data', () => {
  const localStorage = createLocalStorage({
    [IEP_SOURCE_STORAGE_KEY]: '{"version":1,"text":42}',
  })

  withMockWindow(localStorage, () => {
    assert.equal(loadPersistedIepSource(), null)
    assert.equal(loadPersistedIepDetails(), null)
    assert.equal(localStorage.getItem(IEP_SOURCE_STORAGE_KEY), null)
  })
})

test('persistIepSource updates and clears the browser-local payload', () => {
  const localStorage = createLocalStorage()

  withMockWindow(localStorage, () => {
    assert.equal(
      persistIepSource(
        { text: 'Clarified directions and chunked instructions' },
        'Auditory processing note',
      ),
      true,
    )
    assert.match(
      localStorage.getItem(IEP_SOURCE_STORAGE_KEY) ?? '',
      /Clarified directions and chunked instructions/,
    )
    assert.match(
      localStorage.getItem(IEP_SOURCE_STORAGE_KEY) ?? '',
      /Auditory processing note/,
    )

    assert.equal(persistIepSource({ text: '' }, ''), false)
    assert.equal(localStorage.getItem(IEP_SOURCE_STORAGE_KEY), null)
  })
})
