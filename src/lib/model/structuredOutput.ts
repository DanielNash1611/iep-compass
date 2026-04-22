function stripJsonFence(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)

  return fencedMatch ? fencedMatch[1].trim() : content.trim()
}

function findBalancedJsonCandidate(content: string) {
  const startIndex = content.search(/[{\x5B]/)

  if (startIndex < 0) {
    return undefined
  }

  const openingCharacter = content[startIndex]
  const closingCharacter = openingCharacter === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < content.length; index += 1) {
    const character = content[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }

      continue
    }

    if (character === '"') {
      inString = true
      continue
    }

    if (character === openingCharacter) {
      depth += 1
    } else if (character === closingCharacter) {
      depth -= 1

      if (depth === 0) {
        return content.slice(startIndex, index + 1).trim()
      }
    }
  }

  return undefined
}

export function extractJsonTextFromModelOutput(content: string) {
  const strippedContent = stripJsonFence(content)

  try {
    JSON.parse(strippedContent)
    return strippedContent
  } catch {
    const balancedCandidate = findBalancedJsonCandidate(strippedContent)

    if (balancedCandidate) {
      return balancedCandidate
    }

    throw new Error('Model response did not contain a complete JSON object.')
  }
}

export function parseJsonFromModelOutput(content: string) {
  return JSON.parse(extractJsonTextFromModelOutput(content)) as unknown
}

export function describeObjectKeys(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  return Object.keys(value).slice(0, 12)
}
