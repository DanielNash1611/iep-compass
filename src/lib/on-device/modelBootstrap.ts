import { FilesetResolver, LlmInference, type LlmInferenceOptions } from '@mediapipe/tasks-genai'
import {
  getOrCacheModelAsset,
  requestPersistentModelStorage,
  type CachedModelAssetSource,
} from './modelAssetCache'
import { DEFAULT_WASM_ROOT } from './modelConfig'

export interface BootstrapPhase {
  detail: string
  source?: CachedModelAssetSource
  state: 'checking-cache' | 'downloading' | 'loading'
}

export interface BootstrapOptions {
  lightMode: boolean
  modelAssetPath: string
  onPhaseChange?: (phase: BootstrapPhase) => void
  wasmRoot?: string
}

export interface LoadedModelResources {
  dispose: () => void
  llmInference: LlmInference
}

export async function bootstrapGemma4Model(
  options: BootstrapOptions,
): Promise<LoadedModelResources> {
  const onPhaseChange = options.onPhaseChange
  const wasmRoot = options.wasmRoot || DEFAULT_WASM_ROOT
  const modeOptions = options.lightMode
    ? {
        maxTokens: 256,
        temperature: 0.2,
        topK: 20,
      }
    : {
        maxTokens: 384,
        temperature: 0.35,
        topK: 32,
      }

  onPhaseChange?.({
    detail:
      'Checking whether this browser can keep Gemma saved for later visits.',
    state: 'checking-cache',
  })

  const storageResult = await requestPersistentModelStorage()

  onPhaseChange?.({
    detail: storageResult.granted
      ? 'Chrome agreed to keep IEP Compass model storage more persistently.'
      : 'Preparing the WebAssembly runtime and checking for a saved Gemma model.',
    state: 'checking-cache',
  })

  const wasmFileset = await FilesetResolver.forGenAiTasks(wasmRoot)
  const device = await LlmInference.createWebGpuDevice()
  const modelAsset = await getOrCacheModelAsset(
    options.modelAssetPath,
    (progress) => {
      onPhaseChange?.({
        detail: progress.detail,
        source: progress.source,
        state: progress.source === 'cache-storage' ? 'checking-cache' : 'downloading',
      })
    },
  )

  onPhaseChange?.({
    detail:
      modelAsset.source === 'cache-storage'
        ? 'Initializing WebGPU resources and loading Gemma from this browser.'
        : 'Initializing WebGPU resources and loading the newly saved Gemma model.',
    source: modelAsset.source,
    state: 'loading',
  })

  const llmOptions: LlmInferenceOptions = {
    baseOptions: {
      delegate: 'GPU',
      gpuOptions: {
        device,
      },
      modelAssetBuffer: modelAsset.reader,
    },
    maxTokens: modeOptions.maxTokens,
    randomSeed: 7,
    temperature: modeOptions.temperature,
    topK: modeOptions.topK,
  }

  const llmInference = await LlmInference.createFromOptions(
    wasmFileset,
    llmOptions,
  )

  return {
    dispose: () => {
      llmInference.close()

      try {
        device.destroy()
      } catch {
        // Best-effort cleanup only; older implementations may no-op here.
      }
    },
    llmInference,
  }
}
