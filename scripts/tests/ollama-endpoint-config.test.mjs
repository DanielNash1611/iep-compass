import test from 'node:test'
import assert from 'node:assert/strict'

import {
  OLLAMA_ENDPOINT_STORAGE_KEY,
  normalizeOllamaEndpoint,
  resolveOllamaEndpoint,
} from '../../src/lib/on-device/ollamaEndpointConfig.ts'

function createStorage(initialValue = null) {
  const values = new Map()

  if (initialValue !== null) {
    values.set(OLLAMA_ENDPOINT_STORAGE_KEY, initialValue)
  }

  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

test('saved Ollama endpoint wins over VITE_GEMMA_BASE_URL', () => {
  const endpoint = resolveOllamaEndpoint({
    envBaseUrl: '/api/ollama',
    storage: createStorage('http://127.0.0.1:11434/v1'),
  })

  assert.equal(endpoint.baseUrl, 'http://127.0.0.1:11434/v1')
  assert.equal(endpoint.envBaseUrl, '/api/ollama')
  assert.equal(endpoint.source, 'saved')
})

test('env /api/ollama still configures local dev', () => {
  const endpoint = resolveOllamaEndpoint({
    envBaseUrl: '/api/ollama',
    storage: createStorage(),
  })

  assert.equal(endpoint.baseUrl, '/api/ollama')
  assert.equal(endpoint.source, 'env')
})

test('saved localhost v1 endpoint configures the browser without env', () => {
  const endpoint = resolveOllamaEndpoint({
    storage: createStorage('http://127.0.0.1:11434/v1'),
  })

  assert.equal(endpoint.baseUrl, 'http://127.0.0.1:11434/v1')
  assert.equal(endpoint.source, 'saved')
})

test('bare local Ollama origin normalizes to the OpenAI-compatible v1 path', () => {
  assert.equal(
    normalizeOllamaEndpoint('http://127.0.0.1:11434'),
    'http://127.0.0.1:11434/v1',
  )
  assert.equal(
    normalizeOllamaEndpoint('http://localhost:11434/'),
    'http://localhost:11434/v1',
  )
})

test('empty saved endpoint falls back to env endpoint', () => {
  const endpoint = resolveOllamaEndpoint({
    envBaseUrl: '/api/ollama',
    storage: createStorage('   '),
  })

  assert.equal(endpoint.baseUrl, '/api/ollama')
  assert.equal(endpoint.source, 'env')
})
