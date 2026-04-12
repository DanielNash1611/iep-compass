import type { AnalysisModelAdapter } from './adapter'
import { parseAnalysisResult } from '../schema/analysisSchema'
import {
  buildGemmaSystemPrompt,
  buildGemmaUserPrompt,
  GEMMA_FALLBACK_MODEL_ID,
  GEMMA_FALLBACK_MODEL_LABEL,
  GEMMA_PRIMARY_MODEL_ID,
  GEMMA_PRIMARY_MODEL_LABEL,
} from './prompt'
import { runDeterministicAnalysis } from './mockAnalysis'
import type { AnalysisExecution, AnalysisRequest } from '../../types/analysis'

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
  fallbackModel: string
  multimodalReady: boolean
  primaryModel: string
}

function readConfig(): GemmaConfig {
  return {
    apiKey: import.meta.env.VITE_GEMMA_API_KEY?.trim(),
    baseUrl: import.meta.env.VITE_GEMMA_BASE_URL?.trim(),
    fallbackModel:
      import.meta.env.VITE_GEMMA_FALLBACK_MODEL?.trim() || GEMMA_FALLBACK_MODEL_ID,
    multimodalReady: import.meta.env.VITE_GEMMA_MULTIMODAL === 'true',
    primaryModel:
      import.meta.env.VITE_GEMMA_PRIMARY_MODEL?.trim() || GEMMA_PRIMARY_MODEL_ID,
  }
}

function extractJson(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fencedMatch ? fencedMatch[1].trim() : content.trim()
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown model error'
}

class ConfigurableGemmaAdapter implements AnalysisModelAdapter {
  private readonly config = readConfig()

  getModelPlan() {
    return {
      fallbackLabel: GEMMA_FALLBACK_MODEL_LABEL,
      multimodalReady: this.config.multimodalReady,
      primaryLabel: GEMMA_PRIMARY_MODEL_LABEL,
      remoteConfigured: Boolean(this.config.baseUrl),
    }
  }

  async analyze(request: AnalysisRequest): Promise<AnalysisExecution> {
    const attachmentNotes = this.buildAttachmentNotes(request)

    if (!this.config.baseUrl) {
      return {
        meta: {
          adapterLabel: 'Gemma 4 adapter',
          mode: 'demo',
          model: `${GEMMA_PRIMARY_MODEL_LABEL} plan`,
          notes: [
            'No Gemma endpoint is configured, so the MVP is using deterministic demo analysis.',
            ...attachmentNotes,
          ],
          usedFallback: false,
        },
        result: runDeterministicAnalysis(request),
      }
    }

    try {
      const result = await this.callRemoteModel(this.config.primaryModel, request)

      return {
        meta: {
          adapterLabel: 'Gemma 4 adapter',
          mode: 'remote',
          model: GEMMA_PRIMARY_MODEL_LABEL,
          notes: attachmentNotes,
          usedFallback: false,
        },
        result,
      }
    } catch (primaryError) {
      try {
        const fallbackResult = await this.callRemoteModel(
          this.config.fallbackModel,
          request,
        )

        return {
          meta: {
            adapterLabel: 'Gemma 4 adapter',
            mode: 'remote',
            model: GEMMA_FALLBACK_MODEL_LABEL,
            notes: [
              `Primary model issue: ${formatError(primaryError)}`,
              ...attachmentNotes,
            ],
            usedFallback: true,
          },
          result: fallbackResult,
        }
      } catch (fallbackError) {
        return {
          meta: {
            adapterLabel: 'Gemma 4 adapter',
            mode: 'demo',
            model: `${GEMMA_FALLBACK_MODEL_LABEL} -> deterministic demo`,
            notes: [
              `Primary model issue: ${formatError(primaryError)}`,
              `Fallback model issue: ${formatError(fallbackError)}`,
              'The app dropped into deterministic demo mode so the MVP stays usable.',
              ...attachmentNotes,
            ],
            usedFallback: true,
          },
          result: runDeterministicAnalysis(request),
        }
      }
    }
  }

  private buildAttachmentNotes(request: AnalysisRequest) {
    if (request.attachments.length === 0) {
      return ['No uploads were attached for this analysis run.']
    }

    if (!this.config.multimodalReady) {
      return [
        'Uploads were included as reference notes. Paste the important task text as well unless the endpoint is upgraded for multimodal input.',
      ]
    }

    return ['Multimodal-ready endpoint configured; uploads can be incorporated in later iterations of this adapter.']
  }

  private async callRemoteModel(model: string, request: AnalysisRequest) {
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
            content: buildGemmaSystemPrompt(),
            role: 'system',
          },
          {
            content: buildGemmaUserPrompt(request),
            role: 'user',
          },
        ],
        model,
        response_format: {
          type: 'json_object',
        },
        temperature: 0.1,
      }),
      headers,
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Remote model request failed with ${response.status}`)
    }

    const payload = (await response.json()) as OpenAICompatibleResponse
    const content = payload.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('Remote model did not return message content')
    }

    // Safety-sensitive: any model output must validate against the shared Zod schema before rendering.
    return parseAnalysisResult(JSON.parse(extractJson(content)))
  }
}

export function createAnalysisAdapter() {
  return new ConfigurableGemmaAdapter()
}
