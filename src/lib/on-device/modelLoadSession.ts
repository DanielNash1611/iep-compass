const STORAGE_KEY = 'iep-compass:browser-model-ready:v1'
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000

interface StoredModelLoadSession {
  loadedAt: number
  modelAssetPath: string
}

function parseStoredSession(rawValue: string | null): StoredModelLoadSession | null {
  if (!rawValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<StoredModelLoadSession>

    if (
      typeof parsedValue.loadedAt !== 'number' ||
      typeof parsedValue.modelAssetPath !== 'string'
    ) {
      return null
    }

    return {
      loadedAt: parsedValue.loadedAt,
      modelAssetPath: parsedValue.modelAssetPath,
    }
  } catch {
    return null
  }
}

export function canReuseModelLoadSession(
  rawValue: string | null,
  modelAssetPath: string,
  now = Date.now(),
) {
  const storedSession = parseStoredSession(rawValue)

  if (!storedSession) {
    return false
  }

  return (
    storedSession.modelAssetPath === modelAssetPath &&
    now - storedSession.loadedAt >= 0 &&
    now - storedSession.loadedAt <= SESSION_MAX_AGE_MS
  )
}

export function hasReusableModelLoadSession(modelAssetPath: string) {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return canReuseModelLoadSession(
      window.sessionStorage.getItem(STORAGE_KEY),
      modelAssetPath,
    )
  } catch {
    return false
  }
}

export function rememberModelLoadSession(modelAssetPath: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        loadedAt: Date.now(),
        modelAssetPath,
      } satisfies StoredModelLoadSession),
    )
  } catch {
    // Storage can be unavailable in private or constrained browser contexts.
  }
}
