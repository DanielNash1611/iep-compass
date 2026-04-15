import type { AnalysisModelAdapter } from './adapter'
import {
  parseAnalysisResult,
  parseTeacherConcernEvaluation,
} from '../schema/analysisSchema'
import {
  buildGemmaSystemPrompt,
  buildTeacherConcernSystemPrompt,
  buildTeacherConcernUserPrompt,
  buildGemmaUserPrompt,
  GEMMA_LOCAL_MODEL_ID,
  GEMMA_LOCAL_MODEL_LABEL,
} from './prompt'
import {
  runDeterministicAnalysis,
  runTeacherConcernAnalysis,
} from './mockAnalysis'
import type {
  AnalysisExecution,
  AnalysisRequest,
  TeacherConcernExecution,
  TeacherConcernRequest,
} from '../../types/analysis'

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface GemmaConfig {
  apiKey?: string
  baseUrl?: string
  fallbackModel?: string
  multimodalReady: boolean
  primaryModel: string
}

const MODEL_LABELS: Record<string, string> = {
  [GEMMA_LOCAL_MODEL_ID]: GEMMA_LOCAL_MODEL_LABEL,
}

const STRUCTURED_DEMO_LABEL = 'Structured demo'

function readConfig(): GemmaConfig {
  return {
    apiKey: import.meta.env.VITE_GEMMA_API_KEY?.trim(),
    baseUrl: import.meta.env.VITE_GEMMA_BASE_URL?.trim(),
    fallbackModel: import.meta.env.VITE_GEMMA_FALLBACK_MODEL?.trim() || undefined,
    multimodalReady: import.meta.env.VITE_GEMMA_MULTIMODAL === 'true',
    primaryModel: import.meta.env.VITE_GEMMA_PRIMARY_MODEL?.trim() || GEMMA_LOCAL_MODEL_ID,
  }
}

function extractJson(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fencedMatch ? fencedMatch[1].trim() : content.trim()
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown model error'
}

function formatModelLabel(model: string) {
  return MODEL_LABELS[model] ?? model
}

function describeRuntime(baseUrl?: string) {
  if (!baseUrl) {
    return STRUCTURED_DEMO_LABEL
  }

  return /(^\/api\/ollama)|localhost:11434|127\.0\.0\.1:11434/i.test(baseUrl)
    ? 'Local Ollama'
    : 'Configured endpoint'
}

class ConfigurableGemmaAdapter implements AnalysisModelAdapter {
  private readonly config = readConfig()
  private readonly runtimeLabel = describeRuntime(this.config.baseUrl)

  getModelPlan() {
    return {
      fallbackLabel: this.config.fallbackModel
        ? formatModelLabel(this.config.fallbackModel)
        : STRUCTURED_DEMO_LABEL,
      liveConfigured: Boolean(this.config.baseUrl),
      multimodalReady: this.config.multimodalReady,
      primaryLabel: formatModelLabel(this.config.primaryModel),
      runtimeLabel: this.runtimeLabel,
    }
  }

  async analyze(request: AnalysisRequest): Promise<AnalysisExecution> {
    const attachmentNotes = this.buildAttachmentNotes(request)
    const primaryLabel = formatModelLabel(this.config.primaryModel)

    if (!this.config.baseUrl) {
      return {
        meta: {
          adapterLabel: 'Gemma adapter',
          mode: 'demo',
          model: STRUCTURED_DEMO_LABEL,
          notes: [
            `No live model endpoint is configured for ${primaryLabel}, so the MVP is using deterministic demo analysis.`,
            ...attachmentNotes,
          ],
          runtimeLabel: STRUCTURED_DEMO_LABEL,
          usedFallback: false,
        },
        result: runDeterministicAnalysis(request),
      }
    }

    try {
      const result = await this.callLiveModel({
        model: this.config.primaryModel,
        parseResponse: parseAnalysisResult,
        systemPrompt: buildGemmaSystemPrompt(),
        userPrompt: buildGemmaUserPrompt(request),
      })

      return {
        meta: {
          adapterLabel: 'Gemma adapter',
          mode: 'live',
          model: primaryLabel,
          notes: attachmentNotes,
          runtimeLabel: this.runtimeLabel,
          usedFallback: false,
        },
        result,
      }
    } catch (primaryError) {
      if (!this.config.fallbackModel) {
        return {
          meta: {
            adapterLabel: 'Gemma adapter',
            mode: 'demo',
            model: STRUCTURED_DEMO_LABEL,
            notes: [
              `Primary model issue (${primaryLabel}): ${formatError(primaryError)}`,
              'The app dropped into deterministic demo mode so the MVP stays usable.',
              ...attachmentNotes,
            ],
            runtimeLabel: STRUCTURED_DEMO_LABEL,
            usedFallback: true,
          },
          result: runDeterministicAnalysis(request),
        }
      }

      try {
        const fallbackResult = await this.callLiveModel({
          model: this.config.fallbackModel,
          parseResponse: parseAnalysisResult,
          systemPrompt: buildGemmaSystemPrompt(),
          userPrompt: buildGemmaUserPrompt(request),
        })
        const fallbackLabel = formatModelLabel(this.config.fallbackModel)

        return {
          meta: {
            adapterLabel: 'Gemma adapter',
            mode: 'live',
            model: fallbackLabel,
            notes: [
              `Primary model issue (${primaryLabel}): ${formatError(primaryError)}`,
              ...attachmentNotes,
            ],
            runtimeLabel: this.runtimeLabel,
            usedFallback: true,
          },
          result: fallbackResult,
        }
      } catch (fallbackError) {
        return {
          meta: {
            adapterLabel: 'Gemma adapter',
            mode: 'demo',
            model: STRUCTURED_DEMO_LABEL,
            notes: [
              `Primary model issue (${primaryLabel}): ${formatError(primaryError)}`,
              `Fallback model issue (${formatModelLabel(this.config.fallbackModel)}): ${formatError(fallbackError)}`,
              'The app dropped into deterministic demo mode so the MVP stays usable.',
              ...attachmentNotes,
            ],
            runtimeLabel: STRUCTURED_DEMO_LABEL,
            usedFallback: true,
          },
          result: runDeterministicAnalysis(request),
        }
      }
    }
  }

  async analyzeTeacherConcern(
    request: TeacherConcernRequest,
  ): Promise<TeacherConcernExecution> {
    const attachmentNotes = this.buildAttachmentNotes(request)
    const primaryLabel = formatModelLabel(this.config.primaryModel)

    if (!this.config.baseUrl) {
      return {
        meta: {
          adapterLabel: 'Gemma adapter',
          mode: 'demo',
          model: STRUCTURED_DEMO_LABEL,
          notes: [
            `No live model endpoint is configured for ${primaryLabel}, so the MVP is using deterministic demo analysis.`,
            ...attachmentNotes,
          ],
          runtimeLabel: STRUCTURED_DEMO_LABEL,
          usedFallback: false,
        },
        result: runTeacherConcernAnalysis(request),
      }
    }

    try {
      const result = await this.callLiveModel({
        model: this.config.primaryModel,
        parseResponse: parseTeacherConcernEvaluation,
        systemPrompt: buildTeacherConcernSystemPrompt(),
        userPrompt: buildTeacherConcernUserPrompt(request),
      })

      return {
        meta: {
          adapterLabel: 'Gemma adapter',
          mode: 'live',
          model: primaryLabel,
          notes: attachmentNotes,
          runtimeLabel: this.runtimeLabel,
          usedFallback: false,
        },
        result,
      }
    } catch (primaryError) {
      if (!this.config.fallbackModel) {
        return {
          meta: {
            adapterLabel: 'Gemma adapter',
            mode: 'demo',
            model: STRUCTURED_DEMO_LABEL,
            notes: [
              `Primary model issue (${primaryLabel}): ${formatError(primaryError)}`,
              'The app dropped into deterministic demo mode so the MVP stays usable.',
              ...attachmentNotes,
            ],
            runtimeLabel: STRUCTURED_DEMO_LABEL,
            usedFallback: true,
          },
          result: runTeacherConcernAnalysis(request),
        }
      }

      try {
        const fallbackResult = await this.callLiveModel({
          model: this.config.fallbackModel,
          parseResponse: parseTeacherConcernEvaluation,
          systemPrompt: buildTeacherConcernSystemPrompt(),
          userPrompt: buildTeacherConcernUserPrompt(request),
        })
        const fallbackLabel = formatModelLabel(this.config.fallbackModel)

        return {
          meta: {
            adapterLabel: 'Gemma adapter',
            mode: 'live',
            model: fallbackLabel,
            notes: [
              `Primary model issue (${primaryLabel}): ${formatError(primaryError)}`,
              ...attachmentNotes,
            ],
            runtimeLabel: this.runtimeLabel,
            usedFallback: true,
          },
          result: fallbackResult,
        }
      } catch (fallbackError) {
        return {
          meta: {
            adapterLabel: 'Gemma adapter',
            mode: 'demo',
            model: STRUCTURED_DEMO_LABEL,
            notes: [
              `Primary model issue (${primaryLabel}): ${formatError(primaryError)}`,
              `Fallback model issue (${formatModelLabel(this.config.fallbackModel)}): ${formatError(fallbackError)}`,
              'The app dropped into deterministic demo mode so the MVP stays usable.',
              ...attachmentNotes,
            ],
            runtimeLabel: STRUCTURED_DEMO_LABEL,
            usedFallback: true,
          },
          result: runTeacherConcernAnalysis(request),
        }
      }
    }
  }

  private buildAttachmentNotes(request: AnalysisRequest) {
    const attachmentCount =
      request.iepSource.attachments.length + request.taskSource.attachments.length

    if (attachmentCount === 0) {
      return ['No uploads were attached for this analysis run.']
    }

    if (!this.config.multimodalReady) {
      return [
        'Uploads were included as reference notes. Paste the important task text as well unless the live endpoint is upgraded for multimodal input.',
      ]
    }

    return ['A multimodal-ready endpoint is configured; uploads can be incorporated in later iterations of this adapter.']
  }

  private async callLiveModel<T>({
    model,
    parseResponse,
    systemPrompt,
    userPrompt,
  }: {
    model: string
    parseResponse: (input: unknown) => T
    systemPrompt: string
    userPrompt: string
  }) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      body: JSON.stringify({
        messages: [
          {
            content: systemPrompt,
            role: 'system',
          },
          {
            content: userPrompt,
            role: 'user',
          },
        ],
        model,
        stream: false,
        response_format: {
          type: 'json_object',
        },
        temperature: 0.1,
      }),
      headers,
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Live model request failed with ${response.status}`)
    }

    const payload = (await response.json()) as OpenAICompatibleResponse
    const content = payload.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('Remote model did not return message content')
    }

    // Safety-sensitive: any model output must validate against the shared Zod schema before rendering.
    return parseResponse(JSON.parse(extractJson(content)))
  }
}

export function createAnalysisAdapter() {
  return new ConfigurableGemmaAdapter()
}
