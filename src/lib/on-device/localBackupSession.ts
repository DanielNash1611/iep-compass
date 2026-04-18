import {
  GEMMA_LOCAL_MODEL_ID,
  GEMMA_LOCAL_MODEL_LABEL,
} from '../analysis/prompt'
import { KID_SAFE_SYSTEM_PROMPT } from './modelConfig'
import {
  normalizePrompt,
  resolveGenerationLimits,
  sanitizeModelOutput,
} from './promptUtils'

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface LocalBackupRequest {
  baseUrl: string
  headers: HeadersInit
  lightMode: boolean
  model: string
  prompt: string
}

export interface LocalBackupConfig {
  configured: boolean
  fallbackLabel: string | null
  fallbackModel?: string
  primaryLabel: string
  primaryModel: string
  runtimeLabel: string
}

export interface LocalBackupResult {
  modelLabel: string
  response: string
  runtimeLabel: string
  usedFallback: boolean
}

const MODEL_LABELS: Record<string, string> = {
  [GEMMA_LOCAL_MODEL_ID]: GEMMA_LOCAL_MODEL_LABEL,
}

function formatModelLabel(model: string) {
  return MODEL_LABELS[model] ?? model
}

function describeRuntime(baseUrl?: string) {
  if (!baseUrl) {
    return 'Unavailable'
  }

  return /(^\/api\/ollama)|localhost:11434|127\.0\.0\.1:11434/i.test(baseUrl)
    ? 'Local Ollama'
    : 'Configured endpoint'
}

function readRawConfig() {
  const primaryModel =
    import.meta.env.VITE_GEMMA_APP_MODEL?.trim()
    || import.meta.env.VITE_GEMMA_PRIMARY_MODEL?.trim()
    || GEMMA_LOCAL_MODEL_ID

  return {
    apiKey: import.meta.env.VITE_GEMMA_API_KEY?.trim(),
    baseUrl: import.meta.env.VITE_GEMMA_BASE_URL?.trim(),
    fallbackModel: import.meta.env.VITE_GEMMA_FALLBACK_MODEL?.trim() || undefined,
    primaryModel,
  }
}

function buildHeaders(apiKey?: string) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return headers
}

async function requestLocalBackup(options: LocalBackupRequest) {
  const limits = resolveGenerationLimits(options.lightMode)
  const prompt = normalizePrompt(options.prompt, limits.maxPromptCharacters)

  if (!prompt) {
    throw new Error('Enter a short prompt before generating.')
  }

  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      max_tokens: limits.maxTokens,
      messages: [
        {
          content: KID_SAFE_SYSTEM_PROMPT,
          role: 'system',
        },
        {
          content: prompt,
          role: 'user',
        },
      ],
      model: options.model,
      stream: false,
      temperature: limits.temperature,
    }),
    headers: options.headers,
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Local backup request failed with ${response.status}`)
  }

  const payload = (await response.json()) as OpenAICompatibleResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Local backup did not return message content')
  }

  return sanitizeModelOutput(content)
}

export function readLocalBackupConfig(): LocalBackupConfig {
  const config = readRawConfig()

  return {
    configured: Boolean(config.baseUrl),
    fallbackLabel: config.fallbackModel
      ? formatModelLabel(config.fallbackModel)
      : null,
    fallbackModel: config.fallbackModel,
    primaryLabel: formatModelLabel(config.primaryModel),
    primaryModel: config.primaryModel,
    runtimeLabel: describeRuntime(config.baseUrl),
  }
}

export async function generateLocalBackupResponse(options: {
  lightMode: boolean
  prompt: string
}): Promise<LocalBackupResult> {
  const config = readRawConfig()

  if (!config.baseUrl) {
    throw new Error(
      'Local backup is not configured. Add VITE_GEMMA_BASE_URL to enable testing against a local model.',
    )
  }

  const headers = buildHeaders(config.apiKey)

  try {
    const response = await requestLocalBackup({
      baseUrl: config.baseUrl,
      headers,
      lightMode: options.lightMode,
      model: config.primaryModel,
      prompt: options.prompt,
    })

    return {
      modelLabel: formatModelLabel(config.primaryModel),
      response,
      runtimeLabel: describeRuntime(config.baseUrl),
      usedFallback: false,
    }
  } catch (primaryError) {
    if (!config.fallbackModel) {
      throw primaryError
    }

    try {
      const response = await requestLocalBackup({
        baseUrl: config.baseUrl,
        headers,
        lightMode: options.lightMode,
        model: config.fallbackModel,
        prompt: options.prompt,
      })

      return {
        modelLabel: formatModelLabel(config.fallbackModel),
        response,
        runtimeLabel: describeRuntime(config.baseUrl),
        usedFallback: true,
      }
    } catch (fallbackError) {
      const primaryMessage =
        primaryError instanceof Error ? primaryError.message : 'unknown error'
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : 'unknown error'

      throw new Error(
        `Local backup failed on ${formatModelLabel(config.primaryModel)} (${primaryMessage}) and ${formatModelLabel(config.fallbackModel)} (${fallbackMessage}).`,
      )
    }
  }
}
