export const OFFICIAL_MODEL_PAGE_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm'

export const OFFICIAL_WEB_MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/blob/main/gemma-4-E2B-it-web.task'

export const OFFICIAL_WEB_MODEL_RESOLVE_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task'

export const DEFAULT_MODEL_ASSET_PATH =
  import.meta.env.VITE_GEMMA4_WEB_MODEL_PATH?.trim() ||
  (import.meta.env.PROD
    ? OFFICIAL_WEB_MODEL_RESOLVE_URL
    : '/models/gemma-4-E2B-it-web.task')

export const DEFAULT_WASM_ROOT =
  import.meta.env.VITE_MEDIAPIPE_WASM_ROOT?.trim() ||
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.27/wasm'

export const GEMMA4_MODEL_LABEL = 'Gemma 4 E2B'

export const LIGHT_MODE_LIMITS = {
  maxInputTokens: 192,
  maxPromptCharacters: 700,
  maxTokens: 256,
  temperature: 0.2,
  topK: 20,
} as const

export const STANDARD_MODE_LIMITS = {
  maxInputTokens: 256,
  maxPromptCharacters: 1200,
  maxTokens: 384,
  temperature: 0.35,
  topK: 32,
} as const

export const KID_SAFE_SYSTEM_PROMPT =
  'You are a brief, kid-safe assistant running on-device in a browser. Keep answers short, avoid adult or dangerous content, and say when you are unsure.'
