import type { JudgeMode } from './types.ts'

export const DEFAULT_IMAGE_EVAL_MODEL = 'gemma4:31b'

export interface ImageEvalConfig {
  apiKey?: string
  baseUrl: string
  inactivityTimeoutMs: number
  judgeModel?: string
  judgeMode: JudgeMode
  model: string
  timeoutMs: number
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizeBaseUrl(rawBaseUrl: string, proxyTarget?: string) {
  const trimmedBaseUrl = rawBaseUrl.trim()
  const normalized = trimSlash(trimmedBaseUrl)
  const trimmedProxyTarget = proxyTarget?.trim()

  if (/^\/(?!\/)/.test(trimmedBaseUrl)) {
    const baseProxyTarget = trimSlash(trimmedProxyTarget || 'http://127.0.0.1:11434')

    if (/^\/api\/ollama$/i.test(normalized)) {
      return `${baseProxyTarget}/v1`
    }

    if (/^\/v1$/i.test(normalized)) {
      return `${baseProxyTarget}/v1`
    }

    return `${baseProxyTarget}${normalized}`
  }

  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized.replace(/\/chat\/completions$/i, '')
  }

  if (/\/api\/ollama$/i.test(normalized)) {
    return normalized.replace(/\/api\/ollama$/i, '/v1')
  }

  if (/\/v1$/i.test(normalized)) {
    return normalized
  }

  return `${normalized}/v1`
}

function readJudgeMode(value?: string): JudgeMode {
  if (value === 'model' || value === 'manual') {
    return value
  }

  return 'off'
}

export function readImageEvalConfig(overrides: {
  judgeMode?: JudgeMode
  judgeModel?: string
  model?: string
} = {}): ImageEvalConfig {
  const rawBaseUrl =
    process.env.GEMMA_IMAGE_EVAL_BASE_URL?.trim()
    || process.env.GEMMA_EVAL_BASE_URL?.trim()
    || process.env.VITE_GEMMA_BASE_URL?.trim()

  if (!rawBaseUrl) {
    throw new Error(
      'Set GEMMA_IMAGE_EVAL_BASE_URL or GEMMA_EVAL_BASE_URL before running image evals.',
    )
  }

  return {
    apiKey:
      process.env.GEMMA_IMAGE_EVAL_API_KEY?.trim()
      || process.env.GEMMA_EVAL_API_KEY?.trim()
      || process.env.VITE_GEMMA_API_KEY?.trim()
      || undefined,
    baseUrl: normalizeBaseUrl(rawBaseUrl, process.env.GEMMA_PROXY_TARGET?.trim()),
    inactivityTimeoutMs: Number(
      process.env.GEMMA_IMAGE_EVAL_INACTIVITY_TIMEOUT_MS?.trim() || '180000',
    ),
    judgeModel:
      overrides.judgeModel
      || process.env.GEMMA_IMAGE_EVAL_JUDGE_MODEL?.trim()
      || process.env.GEMMA_EVAL_JUDGE_MODEL?.trim()
      || undefined,
    judgeMode:
      overrides.judgeMode
      || readJudgeMode(process.env.GEMMA_IMAGE_EVAL_JUDGE_MODE?.trim()),
    model:
      overrides.model
      || process.env.GEMMA_IMAGE_EVAL_MODEL?.trim()
      || DEFAULT_IMAGE_EVAL_MODEL,
    timeoutMs: Number(process.env.GEMMA_IMAGE_EVAL_TIMEOUT_MS?.trim() || '600000'),
  }
}
