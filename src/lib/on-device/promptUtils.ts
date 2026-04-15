import { LIGHT_MODE_LIMITS, STANDARD_MODE_LIMITS } from './modelConfig'

export function resolveGenerationLimits(lightMode: boolean) {
  return lightMode ? LIGHT_MODE_LIMITS : STANDARD_MODE_LIMITS
}

export function normalizePrompt(input: string, maxCharacters: number) {
  return input
    .replace(/<\|turn>|<turn\|>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxCharacters)
}

export function sanitizeModelOutput(input: string) {
  const withoutFinishedThinking = input.replace(
    /<\|channel>thought[\s\S]*?<channel\|>/g,
    '',
  )
  const unfinishedThoughtIndex = withoutFinishedThinking.indexOf(
    '<|channel>thought',
  )
  const withoutThought =
    unfinishedThoughtIndex >= 0
      ? withoutFinishedThinking.slice(0, unfinishedThoughtIndex)
      : withoutFinishedThinking

  return withoutThought
    .replace(/<\|turn>model/g, '')
    .replace(/<\|turn>user/g, '')
    .replace(/<\|turn>system/g, '')
    .replace(/<turn\|>/g, '')
    .replace(/<\|begin_of_text\|>/g, '')
    .trim()
}
