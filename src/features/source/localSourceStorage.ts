import type { SourceMaterial } from '../../types/analysis'

const IEP_SOURCE_STORAGE_KEY = 'iep-compass:iep-source'
const IEP_SOURCE_STORAGE_VERSION = 2

interface PersistedIepSourceV1 {
  text: string
  version: 1
}

interface PersistedIepSourceV2 {
  learningProfile: string
  text: string
  version: typeof IEP_SOURCE_STORAGE_VERSION
}

interface PersistedIepDetails {
  learningProfile: string
  source: SourceMaterial
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
    value.version === 1 &&
    typeof value.text === 'string'
  )
}

export function serializePersistedIepSource(
  source: Pick<SourceMaterial, 'text'>,
  learningProfile = '',
) {
  if (!source.text.trim() && !learningProfile.trim()) {
    return null
  }

  return JSON.stringify({
    learningProfile,
    text: source.text,
    version: IEP_SOURCE_STORAGE_VERSION,
  } satisfies PersistedIepSourceV2)
}

function isPersistedIepSourceV2(
  value: unknown,
): value is PersistedIepSourceV2 {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'text' in value &&
    'learningProfile' in value &&
    value.version === IEP_SOURCE_STORAGE_VERSION &&
    typeof value.text === 'string' &&
    typeof value.learningProfile === 'string'
  )
}

export function deserializePersistedIepDetails(
  rawValue: string | null,
): PersistedIepDetails | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(rawValue)

    if (isPersistedIepSourceV1(parsedValue)) {
      if (!parsedValue.text.trim()) {
        return null
      }

      return {
        learningProfile: '',
        source: {
          attachments: [],
          text: parsedValue.text,
        },
      }
    }

    if (
      !isPersistedIepSourceV2(parsedValue) ||
      (!parsedValue.text.trim() && !parsedValue.learningProfile.trim())
    ) {
      return null
    }

    return {
      learningProfile: parsedValue.learningProfile,
      source: {
        attachments: [],
        text: parsedValue.text,
      },
    }
  } catch {
    return null
  }
}

export function deserializePersistedIepSource(rawValue: string | null) {
  const details = deserializePersistedIepDetails(rawValue)

  return details?.source.text.trim() ? details.source : null
}

export function loadPersistedIepDetails() {
  const storage = getLocalStorage()

  if (!storage) {
    return null
  }

  const rawValue = storage.getItem(IEP_SOURCE_STORAGE_KEY)
  const savedDetails = deserializePersistedIepDetails(rawValue)

  if (!savedDetails && rawValue) {
    storage.removeItem(IEP_SOURCE_STORAGE_KEY)
  }

  return savedDetails
}

export function loadPersistedIepSource() {
  return loadPersistedIepDetails()?.source ?? null
}

export function hasPersistedIepSource() {
  return loadPersistedIepDetails() !== null
}

export function persistIepSource(
  source: Pick<SourceMaterial, 'text'>,
  learningProfile = '',
) {
  const storage = getLocalStorage()

  if (!storage) {
    return false
  }

  const serializedSource = serializePersistedIepSource(source, learningProfile)

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
