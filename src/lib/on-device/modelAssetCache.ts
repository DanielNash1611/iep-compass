export type CachedModelAssetSource = 'cache-storage' | 'network'

export interface CachedModelAsset {
  reader: ReadableStreamDefaultReader<Uint8Array>
  source: CachedModelAssetSource
}

export interface ModelStoragePersistenceResult {
  estimate?: StorageEstimate
  granted: boolean
  supported: boolean
}

export interface ModelAssetCacheProgress {
  detail: string
  source: CachedModelAssetSource
}

const CACHE_NAME = 'iep-compass-browser-model-v1'

async function openModelCache() {
  if (typeof caches === 'undefined') {
    throw new Error('This browser does not expose Cache Storage for the model.')
  }

  return caches.open(CACHE_NAME)
}

function buildModelRequest(modelAssetPath: string) {
  return new Request(modelAssetPath, {
    cache: 'no-store',
    mode: 'cors',
  })
}

async function getCachedModelResponse(modelAssetPath: string) {
  const cache = await openModelCache()
  return cache.match(modelAssetPath)
}

function getReadableModelStream(response: Response) {
  if (!response.body) {
    throw new Error('The cached Gemma model could not be opened as a stream.')
  }

  return response.body.getReader()
}

export async function requestPersistentModelStorage(): Promise<ModelStoragePersistenceResult> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return {
      granted: false,
      supported: false,
    }
  }

  const estimate = await navigator.storage.estimate?.()
  const granted = await navigator.storage.persist?.()

  return {
    estimate,
    granted: Boolean(granted),
    supported: typeof navigator.storage.persist === 'function',
  }
}

export async function hasCachedModelAsset(modelAssetPath: string) {
  try {
    return Boolean(await getCachedModelResponse(modelAssetPath))
  } catch {
    return false
  }
}

export async function getCachedModelAsset(
  modelAssetPath: string,
): Promise<CachedModelAsset | null> {
  const response = await getCachedModelResponse(modelAssetPath)

  if (!response) {
    return null
  }

  return {
    reader: getReadableModelStream(response),
    source: 'cache-storage',
  }
}

export async function downloadAndCacheModelAsset(
  modelAssetPath: string,
  onProgress?: (progress: ModelAssetCacheProgress) => void,
): Promise<CachedModelAsset> {
  const cache = await openModelCache()
  const request = buildModelRequest(modelAssetPath)

  onProgress?.({
    detail:
      'Downloading Gemma over Wi-Fi and saving it in this browser for later visits.',
    source: 'network',
  })

  const response = await fetch(request)

  if (!response.ok) {
    throw new Error(`Gemma model download failed with ${response.status}.`)
  }

  if (response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
    throw new Error('The model URL returned a web page instead of the Gemma task file.')
  }

  await cache.put(modelAssetPath, response.clone())

  const cachedResponse = await cache.match(modelAssetPath)

  if (!cachedResponse) {
    throw new Error('Gemma downloaded, but the browser did not keep it in Cache Storage.')
  }

  return {
    reader: getReadableModelStream(cachedResponse),
    source: 'network',
  }
}

export async function getOrCacheModelAsset(
  modelAssetPath: string,
  onProgress?: (progress: ModelAssetCacheProgress) => void,
): Promise<CachedModelAsset> {
  const cachedAsset = await getCachedModelAsset(modelAssetPath)

  if (cachedAsset) {
    onProgress?.({
      detail: 'Found the Gemma model saved in this browser. Loading from this device.',
      source: 'cache-storage',
    })

    return cachedAsset
  }

  return downloadAndCacheModelAsset(modelAssetPath, onProgress)
}
