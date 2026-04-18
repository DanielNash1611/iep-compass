import { Ollama, type AbortableAsyncIterator, type ChatResponse } from 'ollama'

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface OllamaChatChunk {
  done?: boolean
  load_duration?: number
  message?: {
    content?: string
    thinking?: string
  }
  total_duration?: number
}

export interface ChatMessage {
  content:
    | string
    | Array<
        | {
            text: string
            type: 'text'
          }
        | {
            image_url: {
              url: string
            }
            type: 'image_url'
          }
      >
  role: 'system' | 'user'
}

export function extractJson(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fencedMatch ? fencedMatch[1].trim() : content.trim()
}

export async function callOpenAiCompatibleJson(options: {
  apiKey?: string
  baseUrl: string
  messages: ChatMessage[]
  model: string
  temperature?: number
  timeoutMs?: number
}) {
  const startedAt = Date.now()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (options.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`
  }

  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages: options.messages,
      model: options.model,
      response_format: {
        type: 'json_object',
      },
      stream: false,
      temperature: options.temperature ?? 0,
    }),
    headers,
    method: 'POST',
    signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(
      `Model request failed with ${response.status}${details ? `: ${details}` : ''}`,
    )
  }

  const payload = (await response.json()) as OpenAICompatibleResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Model response did not include message content.')
  }

  return {
    extractedJson: extractJson(content),
    rawContent: content,
    runtimeMs: Date.now() - startedAt,
  }
}

export async function callOpenAiCompatibleText(options: {
  apiKey?: string
  baseUrl: string
  messages: ChatMessage[]
  model: string
  temperature?: number
  timeoutMs?: number
}) {
  const startedAt = Date.now()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (options.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`
  }

  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages: options.messages,
      model: options.model,
      stream: false,
      temperature: options.temperature ?? 0,
    }),
    headers,
    method: 'POST',
    signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(
      `Model request failed with ${response.status}${details ? `: ${details}` : ''}`,
    )
  }

  const payload = (await response.json()) as OpenAICompatibleResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Model response did not include message content.')
  }

  return {
    rawContent: content,
    runtimeMs: Date.now() - startedAt,
  }
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizeOllamaHost(baseUrl: string) {
  return trimSlash(baseUrl).replace(/\/v1$/i, '')
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
  message: string,
) {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout()
          reject(new Error(message))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export async function callOllamaNativeText(options: {
  baseUrl: string
  imagePath?: string
  inactivityTimeoutMs?: number
  model: string
  prompt: string
  stream?: boolean
  temperature?: number
  timeoutMs?: number
}) {
  const ollama = new Ollama({
    host: normalizeOllamaHost(options.baseUrl),
  })
  const startedAt = Date.now()
  const totalTimeoutMs = options.timeoutMs ?? 90_000
  const inactivityTimeoutMs = options.inactivityTimeoutMs ?? 60_000
  const useStream = options.stream ?? true

  if (!useStream) {
    const response = await withTimeout(
      ollama.chat({
        messages: [
          {
            content: options.prompt,
            ...(options.imagePath
              ? {
                  images: [options.imagePath],
                }
              : {}),
            role: 'user',
          },
        ],
        model: options.model,
        ...(typeof options.temperature === 'number'
          ? {
              options: {
                temperature: options.temperature,
              },
            }
          : {}),
        stream: false,
      }) as Promise<ChatResponse>,
      totalTimeoutMs,
      () => ollama.abort(),
      `Ollama SDK request did not finish within ${totalTimeoutMs}ms.`,
    )

    const content = response.message?.content || ''

    if (!content) {
      throw new Error('Ollama SDK response did not include message content.')
    }

    return {
      rawContent: content,
      runtimeMs: Date.now() - startedAt,
      totalDurationNs: response.total_duration,
    }
  }

  const stream = await withTimeout(
    ollama.chat({
      messages: [
        {
          content: options.prompt,
          ...(options.imagePath
            ? {
                images: [options.imagePath],
              }
            : {}),
          role: 'user',
        },
      ],
      model: options.model,
      ...(typeof options.temperature === 'number'
        ? {
            options: {
              temperature: options.temperature,
            },
          }
        : {}),
      stream: true,
    }) as Promise<AbortableAsyncIterator<ChatResponse>>,
    totalTimeoutMs,
    () => ollama.abort(),
    `Ollama SDK request did not start streaming within ${totalTimeoutMs}ms.`,
  )

  let content = ''
  let firstChunkMs: number | undefined
  let firstContentMs: number | undefined
  let totalDurationNs: number | undefined
  const iterator = stream[Symbol.asyncIterator]()

  while (true) {
    const result = await withTimeout(
      iterator.next(),
      inactivityTimeoutMs,
      () => stream.abort(),
      `Ollama SDK stream was idle for more than ${inactivityTimeoutMs}ms.`,
    )

    if (result.done) {
      break
    }

    if (firstChunkMs === undefined) {
      firstChunkMs = Date.now() - startedAt
    }

    const chunk = result.value as OllamaChatChunk
    totalDurationNs = chunk.total_duration

    if (chunk.message?.content && firstContentMs === undefined) {
      firstContentMs = Date.now() - startedAt
    }

    content += chunk.message?.content || ''
  }

  if (!content) {
    throw new Error('Ollama SDK response did not include message content.')
  }

  return {
    firstChunkMs,
    firstContentMs,
    rawContent: content,
    runtimeMs: Date.now() - startedAt,
    totalDurationNs,
  }
}

export async function callOllamaNativeJson(options: {
  baseUrl: string
  imageBase64?: string
  inactivityTimeoutMs?: number
  model: string
  prompt: string
  temperature?: number
  timeoutMs?: number
}) {
  const response = await callOllamaNativeText(options)

  return {
    ...response,
    extractedJson: extractJson(response.rawContent),
  }
}
