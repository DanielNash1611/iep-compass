import type { LlmInference } from '@mediapipe/tasks-genai'
import { KID_SAFE_SYSTEM_PROMPT } from './modelConfig'
import {
  normalizePrompt,
  resolveGenerationLimits,
  sanitizeModelOutput,
} from './promptUtils'
import type { GenerateOptions } from './types'

function buildGemma4Prompt(userPrompt: string) {
  return [
    '<|turn>system',
    `${KID_SAFE_SYSTEM_PROMPT}<turn|>`,
    '<|turn>user',
    `${userPrompt}<turn|>`,
    '<|turn>model',
  ].join('\n')
}

export class BrowserInferenceSession {
  private readonly llmInference: LlmInference

  constructor(llmInference: LlmInference) {
    this.llmInference = llmInference
  }

  async generate(options: GenerateOptions) {
    const limits = resolveGenerationLimits(options.lightMode)
    const prompt = normalizePrompt(options.prompt, limits.maxPromptCharacters)

    if (!prompt) {
      throw new Error('Enter a short prompt before generating.')
    }

    await this.llmInference.setOptions({
      maxTokens: limits.maxTokens,
      randomSeed: 7,
      temperature: limits.temperature,
      topK: limits.topK,
    })

    const formattedPrompt = buildGemma4Prompt(prompt)
    const estimatedInputTokens = this.llmInference.sizeInTokens(formattedPrompt)

    if (
      typeof estimatedInputTokens === 'number' &&
      estimatedInputTokens > limits.maxInputTokens
    ) {
      throw new Error(
        options.lightMode
          ? 'Light mode keeps prompts short to reduce memory pressure. Shorten the prompt and try again.'
          : 'This prompt is too long for the current memory budget. Shorten it and try again.',
      )
    }

    const finalResponse = await this.llmInference.generateResponse(
      formattedPrompt,
      (partialResult, done) => {
        options.onPartial?.(sanitizeModelOutput(partialResult), done)
      },
    )

    return sanitizeModelOutput(finalResponse)
  }

  cancel() {
    this.llmInference.cancelProcessing()
  }

  dispose() {
    this.llmInference.close()
  }
}
