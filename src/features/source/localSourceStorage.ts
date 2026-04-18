import type { SourceMaterial } from '../../types/analysis'

const IEP_SOURCE_STORAGE_KEY = 'iep-compass:iep-source'
const IEP_SOURCE_STORAGE_VERSION = 1

interface PersistedIepSourceV1 {
  text: string
  version: typeof IEP_SOURCE_STORAGE_VERSION
}

function getLocalStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isPersistedIepSourceV1(
  value: unknown,
): value is PersistedIepSourceV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'text' in value &&
    value.version === IEP_SOURCE_STORAGE_VERSION &&
    typeof value.text === 'string'
  )
}

export function serializePersistedIepSource(
  source: Pick<SourceMaterial, 'text'>,
) {
  if (!source.text.trim()) {
    return null
  }

  return JSON.stringify({
    text: source.text,
    version: IEP_SOURCE_STORAGE_VERSION,
  } satisfies PersistedIepSourceV1)
}

export function deserializePersistedIepSource(rawValue: string | null) {
  if (!rawValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(rawValue)

    if (!isPersistedIepSourceV1(parsedValue) || !parsedValue.text.trim()) {
      return null
    }

    return {
      attachments: [],
      text: parsedValue.text,
    } satisfies SourceMaterial
  } catch {
    return null
  }
}

export function loadPersistedIepSource() {
  const storage = getLocalStorage()

  if (!storage) {
    return null
  }

  const rawValue = storage.getItem(IEP_SOURCE_STORAGE_KEY)
  const savedSource = deserializePersistedIepSource(rawValue)

  if (!savedSource && rawValue) {
    storage.removeItem(IEP_SOURCE_STORAGE_KEY)
  }

  return savedSource
}

export function hasPersistedIepSource() {
  return loadPersistedIepSource() !== null
}

export function persistIepSource(source: Pick<SourceMaterial, 'text'>) {
  const storage = getLocalStorage()

  if (!storage) {
    return false
  }

  const serializedSource = serializePersistedIepSource(source)

  if (!serializedSource) {
    storage.removeItem(IEP_SOURCE_STORAGE_KEY)
    return false
  }

  try {
    // Files and object URLs are session-scoped, so this MVP saves only typed IEP text.
    storage.setItem(IEP_SOURCE_STORAGE_KEY, serializedSource)
    return true
  } catch {
    return hasPersistedIepSource()
  }
}

export function clearPersistedIepSource() {
  const storage = getLocalStorage()

  storage?.removeItem(IEP_SOURCE_STORAGE_KEY)
}
