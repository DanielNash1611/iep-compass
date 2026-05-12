export const ACCOMMODATION_PHOTO_LONG_SIDE = 1800
export const ACCOMMODATION_PHOTO_BROWSER_QUALITY = 0.88
export const ACCOMMODATION_PHOTO_NODE_QUALITY = 85
export const ACCOMMODATION_PHOTO_RECOVERY_CROP_RATIO = 0.72
export const ACCOMMODATION_PHOTO_SIZE_THRESHOLD_BYTES = 1_000_000
export const ACCOMMODATION_PHOTO_LONG_SIDE_THRESHOLD = 1_800

const PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/webp'])
const SECTION_HEADING_PATTERNS = [
  /setting\s*\/\s*scheduling/i,
  /teacher directions/i,
  /student response/i,
  /organization\s*\/\s*study skills/i,
  /self-regulation/i,
  /personal care\s*\/\s*equipment/i,
]
const SIGNAL_PATTERNS: Array<[string, RegExp]> = [
  ['extended_time', /extended time|extra time|time and a half/i],
  ['small_group', /small-group|small group|reduced distraction|seat away|preferential seating/i],
  ['read_aloud', /read aloud|orally|answer choices/i],
  ['speech_to_text', /speech-to-text|speech to text/i],
  ['spelling', /spelling/i],
  ['grammar', /grammar/i],
  ['calculator', /calculator/i],
  ['multiplication_chart', /multiplication chart/i],
  ['graphic_organizer', /graphic organizer/i],
  ['notes', /teacher-provided notes|teacher notes/i],
  ['graph_paper', /graph paper/i],
  ['chunked_instructions', /chunked/i],
  ['breaks', /breaks/i],
  ['frequent_checks', /frequent checks/i],
  ['verbal_encouragement', /verbal encouragement/i],
]

export interface AccommodationImagePrepAsset {
  bytes: number
  dimensions: {
    height: number
    width: number
  }
  mimeType: string
}

export interface AccommodationImagePrepDecision {
  isPhotoMode: boolean
  longSide: number
  normalizedMimeType: 'image/jpeg'
  shouldNormalize: boolean
  targetLongSide: number
}

export interface AccommodationDraftHealth {
  boilerplateLineCount: number
  hasModificationsPreamble: boolean
  isHeadingHeavy: boolean
  lowSignalLineCount: boolean
  sectionHeadingCount: number
  signalLineCount: number
  totalLineCount: number
}

export type AccommodationPhotoRecoveryTileLabel =
  | 'left'
  | 'middle'
  | 'right'
  | 'setting_condition_lines'
  | 'student_response_conditions'
  | 'student_response_exception_lines'

export interface AccommodationPhotoRecoveryTileRect {
  height: number
  label: AccommodationPhotoRecoveryTileLabel
  width: number
  x: number
  y: number
}

export interface AccommodationPhotoRecoveryTileDraft {
  label: AccommodationPhotoRecoveryTileLabel
  text: string
}

function getSignalLineCount(lines: string[]) {
  return lines.filter((line) =>
    SIGNAL_PATTERNS.some(([, pattern]) => pattern.test(line)),
  ).length
}

export function getAccommodationImagePrepDecision(
  asset: AccommodationImagePrepAsset,
): AccommodationImagePrepDecision {
  const longSide = Math.max(asset.dimensions.width, asset.dimensions.height)
  const isPhotoMode =
    PHOTO_MIME_TYPES.has(asset.mimeType)
    || longSide > ACCOMMODATION_PHOTO_LONG_SIDE_THRESHOLD
    || asset.bytes > ACCOMMODATION_PHOTO_SIZE_THRESHOLD_BYTES

  return {
    isPhotoMode,
    longSide,
    normalizedMimeType: 'image/jpeg',
    shouldNormalize: isPhotoMode && longSide > ACCOMMODATION_PHOTO_LONG_SIDE,
    targetLongSide: ACCOMMODATION_PHOTO_LONG_SIDE,
  }
}

export function assessAccommodationDraftHealth(text: string): AccommodationDraftHealth {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const sectionHeadingCount = lines.filter((line) =>
    SECTION_HEADING_PATTERNS.some((pattern) => pattern.test(line)),
  ).length
  const signalLineCount = getSignalLineCount(lines)
  const boilerplateLineCount = lines.filter((line) =>
    /modifications needed|do modifications allow|same grade|form instructions|provided in the classroom/i.test(line),
  ).length
  const hasModificationsPreamble = lines.some((line) =>
    /modifications/i.test(line),
  )
  const lowSignalLineCount = signalLineCount < 2
  const isHeadingHeavy = sectionHeadingCount >= 2 && lowSignalLineCount

  return {
    boilerplateLineCount,
    hasModificationsPreamble,
    isHeadingHeavy,
    lowSignalLineCount,
    sectionHeadingCount,
    signalLineCount,
    totalLineCount: lines.length,
  }
}

export function shouldTriggerAccommodationFocusedRecovery(
  text: string,
  options: {
    isPhotoMode: boolean
  },
) {
  if (!options.isPhotoMode) {
    return false
  }

  const health = assessAccommodationDraftHealth(text)

  return (
    health.isHeadingHeavy
    || health.boilerplateLineCount >= 2
    || (health.hasModificationsPreamble && health.lowSignalLineCount)
  )
}

export function getAccommodationPhotoRecoveryTileRects(dimensions: {
  height: number
  width: number
}): AccommodationPhotoRecoveryTileRect[] {
  const tileTop = Math.max(0, Math.round(dimensions.height * 0.1))
  const tileHeight = Math.max(
    1,
    Math.min(
      dimensions.height - tileTop,
      Math.round(dimensions.height * 0.5),
    ),
  )

  const tiles: AccommodationPhotoRecoveryTileRect[] = [
    {
      height: tileHeight,
      label: 'left',
      width: Math.max(1, Math.round(dimensions.width * 0.34)),
      x: Math.max(0, Math.round(dimensions.width * 0.02)),
      y: tileTop,
    },
    {
      height: tileHeight,
      label: 'middle',
      width: Math.max(1, Math.round(dimensions.width * 0.34)),
      x: Math.max(0, Math.round(dimensions.width * 0.33)),
      y: tileTop,
    },
    {
      height: tileHeight,
      label: 'right',
      width: Math.max(1, Math.round(dimensions.width * 0.34)),
      x: Math.max(0, Math.round(dimensions.width * 0.64)),
      y: tileTop,
    },
    {
      height: Math.max(1, Math.round(dimensions.height * 0.34)),
      label: 'student_response_conditions',
      width: Math.max(1, Math.round(dimensions.width * 0.28)),
      x: Math.max(0, Math.round(dimensions.width * 0.65)),
      y: Math.max(0, Math.round(dimensions.height * 0.08)),
    },
    {
      height: Math.max(1, Math.round(dimensions.height * 0.18)),
      label: 'setting_condition_lines',
      width: Math.max(1, Math.round(dimensions.width * 0.28)),
      x: Math.max(0, Math.round(dimensions.width * 0.04)),
      y: Math.max(0, Math.round(dimensions.height * 0.1)),
    },
    {
      height: Math.max(1, Math.round(dimensions.height * 0.3)),
      label: 'student_response_exception_lines',
      width: Math.max(1, Math.round(dimensions.width * 0.38)),
      x: Math.max(0, Math.round(dimensions.width * 0.6)),
      y: Math.max(0, Math.round(dimensions.height * 0.12)),
    },
  ]

  return tiles.map((tile) => ({
    ...tile,
    height: Math.min(tile.height, dimensions.height - tile.y),
    width: Math.min(tile.width, dimensions.width - tile.x),
  }))
}

function normalizeDraftLine(line: string) {
  return line
    .toLowerCase()
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getDraftLineStem(line: string) {
  return normalizeDraftLine(line)
    .split(' ')
    .slice(0, 4)
    .join(' ')
}

function getDraftLineQualityScore(line: string) {
  let score = line.length

  if (/[a-z]/.test(line)) {
    score += 2
  }

  if (/when requested|except on|unless it is|except for/i.test(line)) {
    score += 4
  }

  if (/\(|\)/.test(line)) {
    score += 1
  }

  return score
}

export function mergeAccommodationPhotoRecoveryTileDrafts(
  drafts: AccommodationPhotoRecoveryTileDraft[],
) {
  const mergedLines: string[] = []
  const normalizedIndexByLine = new Map<string, number>()

  for (const draft of drafts) {
    const lines = draft.text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    for (const line of lines) {
      const normalizedLine = normalizeDraftLine(line)

      if (!normalizedLine) {
        continue
      }

      const existingIndex = normalizedIndexByLine.get(normalizedLine)

      if (typeof existingIndex === 'number') {
        if (
          getDraftLineQualityScore(line)
          > getDraftLineQualityScore(mergedLines[existingIndex])
        ) {
          mergedLines[existingIndex] = line
        }

        continue
      }

      const containingIndex = mergedLines.findIndex((existingLine) => {
        const normalizedExistingLine = normalizeDraftLine(existingLine)
        return normalizedExistingLine.includes(normalizedLine)
      })

      if (containingIndex >= 0) {
        continue
      }

      const containedIndex = mergedLines.findIndex((existingLine) => {
        const normalizedExistingLine = normalizeDraftLine(existingLine)
        return normalizedLine.includes(normalizedExistingLine)
      })

      if (containedIndex >= 0) {
        const previousNormalizedLine = normalizeDraftLine(mergedLines[containedIndex])

        mergedLines[containedIndex] = line
        normalizedIndexByLine.delete(previousNormalizedLine)
        normalizedIndexByLine.set(normalizedLine, containedIndex)
        continue
      }

      const sameStemIndex = mergedLines.findIndex((existingLine) =>
        getDraftLineStem(existingLine) === getDraftLineStem(line),
      )

      if (sameStemIndex >= 0) {
        const previousNormalizedLine = normalizeDraftLine(mergedLines[sameStemIndex])

        if (
          getDraftLineQualityScore(line)
          > getDraftLineQualityScore(mergedLines[sameStemIndex])
        ) {
          mergedLines[sameStemIndex] = line
          normalizedIndexByLine.delete(previousNormalizedLine)
          normalizedIndexByLine.set(normalizedLine, sameStemIndex)
        }

        continue
      }

      mergedLines.push(line)
      normalizedIndexByLine.set(normalizedLine, mergedLines.length - 1)
    }
  }

  return mergedLines.join('\n')
}
