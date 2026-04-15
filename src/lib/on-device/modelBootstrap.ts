import { FilesetResolver, LlmInference, type LlmInferenceOptions } from '@mediapipe/tasks-genai'
import { DEFAULT_WASM_ROOT } from './modelConfig'

export interface BootstrapPhase {
  detail: string
  state: 'downloading' | 'loading'
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
      'Preparing the WebAssembly runtime and starting the browser-managed model fetch.',
    state: 'downloading',
  })

  const wasmFileset = await FilesetResolver.forGenAiTasks(wasmRoot)
  const device = await LlmInference.createWebGpuDevice()

  onPhaseChange?.({
    detail: 'Initializing WebGPU resources and loading Gemma 4 E2B into memory.',
    state: 'loading',
  })

  const llmOptions: LlmInferenceOptions = {
    baseOptions: {
      delegate: 'GPU',
      gpuOptions: {
        device,
      },
      modelAssetPath: options.modelAssetPath,
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
