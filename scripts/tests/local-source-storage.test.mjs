import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deserializePersistedIepSource,
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
  })

  assert.deepEqual(JSON.parse(serialized), {
    text: 'Extended time for quizzes and tests',
    version: 1,
  })
  assert.equal(serializePersistedIepSource({ text: '   ' }), null)
})

test('deserializePersistedIepSource ignores invalid payloads', () => {
  assert.equal(deserializePersistedIepSource(null), null)
  assert.equal(deserializePersistedIepSource('not-json'), null)
  assert.equal(
    deserializePersistedIepSource(JSON.stringify({ text: 'Saved text', version: 2 })),
    null,
  )
})

test('loadPersistedIepSource returns a blank-safe source and clears corrupt local data', () => {
  const localStorage = createLocalStorage({
    [IEP_SOURCE_STORAGE_KEY]: '{"version":1,"text":42}',
  })

  withMockWindow(localStorage, () => {
    assert.equal(loadPersistedIepSource(), null)
    assert.equal(localStorage.getItem(IEP_SOURCE_STORAGE_KEY), null)
  })
})

test('persistIepSource updates and clears the browser-local payload', () => {
  const localStorage = createLocalStorage()

  withMockWindow(localStorage, () => {
    assert.equal(
      persistIepSource({ text: 'Clarified directions and chunked instructions' }),
      true,
    )
    assert.match(
      localStorage.getItem(IEP_SOURCE_STORAGE_KEY) ?? '',
      /Clarified directions and chunked instructions/,
    )

    assert.equal(persistIepSource({ text: '' }), false)
    assert.equal(localStorage.getItem(IEP_SOURCE_STORAGE_KEY), null)
  })
})
