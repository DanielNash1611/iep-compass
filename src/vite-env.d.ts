/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMMA_API_KEY?: string
  readonly VITE_GEMMA_BASE_URL?: string
  readonly VITE_GEMMA_FALLBACK_MODEL?: string
  readonly VITE_GEMMA4_WEB_MODEL_PATH?: string
  readonly VITE_GEMMA_MULTIMODAL?: string
  readonly VITE_GEMMA_PRIMARY_MODEL?: string
  readonly VITE_MEDIAPIPE_WASM_ROOT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
