export const OLLAMA_ENDPOINT_STORAGE_KEY = 'iep-compass:ollama-base-url'

type EndpointSource = 'env' | 'none' | 'saved'

interface EndpointStorage {
  getItem: (key: string) => string | null
  removeItem: (key: string) => void
  setItem: (key: string, value: string) => void
}

export interface ResolvedOllamaEndpoint {
  baseUrl?: string
  envBaseUrl?: string
  savedBaseUrl?: string
  source: EndpointSource
}

function getBrowserStorage(): EndpointStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readEnvBaseUrl() {
  const viteEnv = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env
  return viteEnv?.VITE_GEMMA_BASE_URL?.trim()
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '')
}

export function normalizeOllamaEndpoint(rawValue?: string | null) {
  const trimmedValue = rawValue?.trim()

  if (!trimmedValue) {
    return undefined
  }

  if (/^\/(?!\/)/.test(trimmedValue)) {
    return trimTrailingSlashes(trimmedValue)
  }

  try {
    const url = new URL(trimmedValue)
    const isBareLocalOllama =
      /^(localhost|127\.0\.0\.1)$/i.test(url.hostname) &&
      url.port === '11434' &&
      (url.pathname === '' || url.pathname === '/')

    if (isBareLocalOllama) {
      url.pathname = '/v1'
    } else {
      url.pathname = trimTrailingSlashes(url.pathname)
    }

    return url.toString().replace(/\/+$/, '')
  } catch {
    return trimTrailingSlashes(trimmedValue)
  }
}

export function resolveOllamaEndpoint(options: {
  envBaseUrl?: string
  storage?: EndpointStorage | null
} = {}): ResolvedOllamaEndpoint {
  const storage = options.storage ?? getBrowserStorage()
  const savedBaseUrl = normalizeOllamaEndpoint(
    storage?.getItem(OLLAMA_ENDPOINT_STORAGE_KEY),
  )
  const envBaseUrl = normalizeOllamaEndpoint(options.envBaseUrl ?? readEnvBaseUrl())
  const baseUrl = savedBaseUrl || envBaseUrl

  return {
    baseUrl,
    envBaseUrl,
    savedBaseUrl,
    source: savedBaseUrl ? 'saved' : envBaseUrl ? 'env' : 'none',
  }
}

export function saveOllamaEndpoint(rawValue: string) {
  const storage = getBrowserStorage()
  const baseUrl = normalizeOllamaEndpoint(rawValue)

  if (!storage || !baseUrl) {
    return undefined
  }

  storage.setItem(OLLAMA_ENDPOINT_STORAGE_KEY, baseUrl)
  return baseUrl
}

export function clearSavedOllamaEndpoint() {
  getBrowserStorage()?.removeItem(OLLAMA_ENDPOINT_STORAGE_KEY)
}

export async function testOllamaEndpoint(rawValue: string) {
  const baseUrl = normalizeOllamaEndpoint(rawValue)

  if (!baseUrl) {
    throw new Error('Add an Ollama endpoint before testing.')
  }

  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`The endpoint answered with ${response.status}.`)
  }

  return baseUrl
}
