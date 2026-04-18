import { assessAccommodationDraftHealth } from './accommodationImagePrep.ts'
import { hasUncertaintyMarkers } from './uncertaintyMarkers.ts'

const SECTION_HEADING_PATTERNS = [
  /setting\s*\/\s*scheduling/i,
  /teacher directions/i,
  /student response/i,
  /organization\s*\/\s*study skills/i,
  /self-regulation/i,
  /personal care\s*\/\s*equipment/i,
]

const PROMPT_LEAK_PATTERNS = [
  /read the page in the correct orientation/i,
  /copy only visible document text lines/i,
  /do not add example accommodations/i,
  /do not add accommodations from the prompt/i,
  /important: the example below/i,
  /use this exact shape/i,
  /student name:\s*accommodations/i,
  /return plain text only/i,
]

const BOILERPLATE_PATTERNS = [
  /the accommodations provided by the school or district/i,
  /for the student's benefit/i,
  /reviewed language when available/i,
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

const SUSPICIOUS_SHORT_PAGE_KEYS = new Set([
  'grammar',
  'calculator',
  'multiplication_chart',
  'notes',
  'graph_paper',
  'verbal_encouragement',
])

interface DraftAssessment {
  blankCount: number
  boilerplateCount: number
  headingHeavy: boolean
  lowSignalLineCount: boolean
  lines: string[]
  normalizedLines: string[]
  promptLeakCount: number
  repeatedLineCount: number
  reliable: boolean
  score: number
  sectionHeadingCount: number
  signalKeys: Set<string>
  text: string
}

function normalizeLine(line: string) {
  return line
    .toLowerCase()
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSignalKeys(line: string) {
  const keys = new Set<string>()

  for (const [key, pattern] of SIGNAL_PATTERNS) {
    if (pattern.test(line)) {
      keys.add(key)
    }
  }

  return keys
}

function assessDraft(text: string): DraftAssessment {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const normalizedLines = lines.map(normalizeLine)
  const lineCounts = normalizedLines.reduce<Map<string, number>>((accumulator, line) => {
    accumulator.set(line, (accumulator.get(line) || 0) + 1)
    return accumulator
  }, new Map())
  const repeatedLineCount = Array.from(lineCounts.values()).filter((count) => count > 1).length
  const sectionHeadingCount = lines.filter((line) =>
    SECTION_HEADING_PATTERNS.some((pattern) => pattern.test(line)),
  ).length
  const promptLeakCount = lines.filter((line) =>
    PROMPT_LEAK_PATTERNS.some((pattern) => pattern.test(line)),
  ).length
  const boilerplateCount = lines.filter((line) =>
    BOILERPLATE_PATTERNS.some((pattern) => pattern.test(line)),
  ).length
  const blankCount = lines.filter((line) => /\[blank\]/i.test(line)).length
  const signalKeys = lines.reduce<Set<string>>((accumulator, line) => {
    for (const key of getSignalKeys(line)) {
      accumulator.add(key)
    }

    return accumulator
  }, new Set())
  const draftHealth = assessAccommodationDraftHealth(text)
  const score =
    sectionHeadingCount * 3
    + signalKeys.size * 2
    + (hasUncertaintyMarkers(text) ? 1 : 0)
    - promptLeakCount * 5
    - boilerplateCount * 3
    - repeatedLineCount * 4
    - (draftHealth.isHeadingHeavy ? 12 : 0)
    - (draftHealth.hasModificationsPreamble && draftHealth.lowSignalLineCount ? 8 : 0)
    - Math.max(0, blankCount - 1)
  const reliable =
    promptLeakCount === 0
    && repeatedLineCount === 0
    && boilerplateCount < 2
    && signalKeys.size > 0

  return {
    blankCount,
    boilerplateCount,
    headingHeavy: draftHealth.isHeadingHeavy,
    lowSignalLineCount: draftHealth.lowSignalLineCount,
    lines,
    normalizedLines,
    promptLeakCount,
    repeatedLineCount,
    reliable,
    score,
    sectionHeadingCount,
    signalKeys,
    text: text.trim(),
  }
}

function countSuspiciousShortPageLines(
  candidate: DraftAssessment,
  focusedCandidate?: DraftAssessment,
) {
  if (
    !focusedCandidate?.reliable
    || focusedCandidate.sectionHeadingCount > 1
    || focusedCandidate.lines.length > 8
  ) {
    return 0
  }

  return candidate.lines.filter((line) => {
    const lineKeys = getSignalKeys(line)

    if (![...lineKeys].some((key) => SUSPICIOUS_SHORT_PAGE_KEYS.has(key))) {
      return false
    }

    return !focusedCandidate.lines.some((focusedLine) => {
      const focusedKeys = getSignalKeys(focusedLine)
      return [...lineKeys].some((key) => focusedKeys.has(key))
    })
  }).length
}

export function selectAccommodationDraft(drafts: string[]) {
  const assessments = drafts
    .map((draft) => draft.trim())
    .filter(Boolean)
    .map(assessDraft)

  if (assessments.length === 0) {
    return ''
  }

  const [structuredCandidate, focusedCandidate] = assessments

  if (
    structuredCandidate?.reliable
    && !structuredCandidate.headingHeavy
    && (structuredCandidate.sectionHeadingCount >= 2 || !focusedCandidate?.reliable)
  ) {
    return structuredCandidate.text
  }

  const ranked = assessments
    .map((assessment, index) => {
      let adjustedScore = assessment.score
      const suspiciousShortPageLines = countSuspiciousShortPageLines(
        assessment,
        focusedCandidate,
      )

      if (index === 0) {
        adjustedScore -= suspiciousShortPageLines * 4

        if (assessment.headingHeavy) {
          adjustedScore -= 6
        }
      }

      if (index === 2) {
        adjustedScore -= suspiciousShortPageLines * 2
      }

      if (index === 1 && assessment.reliable) {
        adjustedScore += 1
      }

      if (index === 1 && assessment.lowSignalLineCount === false) {
        adjustedScore += 2
      }

      if (index === 1 && suspiciousShortPageLines >= 2) {
        adjustedScore += 2
      }

      return {
        adjustedScore,
        assessment,
        index,
      }
    })
    .sort((left, right) => right.adjustedScore - left.adjustedScore)

  return ranked[0]?.assessment.text || assessments[0].text
}
