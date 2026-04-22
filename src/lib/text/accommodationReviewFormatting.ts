const SECTION_HEADINGS: Array<{
  pattern: RegExp
  style: 'metadata' | 'section' | 'title'
  title: string
}> = [
  {
    pattern: /^student information:?$/i,
    style: 'metadata',
    title: 'Student Information',
  },
  {
    pattern: /^(approved accommodations|extracted accommodations details|accommodations details):?$/i,
    style: 'title',
    title: 'Approved Accommodations',
  },
  {
    pattern: /^setting\s*\/\s*scheduling:?$/i,
    style: 'section',
    title: 'Setting / Scheduling',
  },
  {
    pattern: /^teacher directions:?$/i,
    style: 'section',
    title: 'Teacher Directions',
  },
  {
    pattern: /^speech\s*&\s*assessment:?$/i,
    style: 'title',
    title: 'Speech & Assessment',
  },
  {
    pattern: /^student response:?$/i,
    style: 'section',
    title: 'Student Response',
  },
  {
    pattern: /^organization\s*\/\s*study skills:?$/i,
    style: 'section',
    title: 'Organization / Study Skills',
  },
  {
    pattern: /^self[- ]regulation(?:\s*&\s*personal care\s*\/\s*equipment)?:?$/i,
    style: 'section',
    title: 'Self-Regulation & Personal Care / Equipment',
  },
  {
    pattern: /^personal care\s*\/\s*equipment:?$/i,
    style: 'section',
    title: 'Personal Care / Equipment',
  },
  {
    pattern: /^modifications:?$/i,
    style: 'metadata',
    title: 'Modifications',
  },
]

const FORM_LABEL_PATTERN =
  /^(student name|date of birth|dob|district|meeting date|overall report card type)\s*:/i

const NOTE_PATTERN = /^(note|important)\s*:/i
const LIST_MARKER_PATTERN = /^[-*•]\s*|^\d+[.)]\s*/

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function stripListMarker(value: string) {
  return value.replace(LIST_MARKER_PATTERN, '').trim()
}

function findHeading(value: string) {
  const normalized = stripListMarker(value).replace(/#+/g, '').trim()

  return SECTION_HEADINGS.find((heading) => heading.pattern.test(normalized))
}

function looksLikeShoutingHeading(value: string) {
  const stripped = stripListMarker(value).replace(/[()[\]/&'-]/g, '').trim()

  if (stripped.length < 4 || stripped.length > 48) {
    return false
  }

  if (/[.:]$/.test(stripped)) {
    return false
  }

  const letters = stripped.replace(/[^A-Za-z]/g, '')

  return letters.length >= 4 && letters === letters.toUpperCase()
}

function titleCaseHeading(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (word === '&' || word === '/') {
        return word
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
    })
    .join(' ')
}

function pushBlankLine(lines: string[]) {
  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    lines.push('')
  }
}

function pushFormattedLine(lines: string[], line: string) {
  if (!line) {
    return
  }

  if (lines[lines.length - 1] === line) {
    return
  }

  lines.push(line)
}

export function formatAccommodationReviewText(text: string) {
  const sourceLines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

  const formattedLines: string[] = []
  let insideAccommodationSection = false
  let insideMetadataSection = false

  for (const sourceLine of sourceLines) {
    const heading = findHeading(sourceLine)

    if (heading) {
      pushBlankLine(formattedLines)
      pushFormattedLine(
        formattedLines,
        heading.style === 'section' ? `${heading.title}:` : heading.title,
      )
      insideAccommodationSection = heading.style === 'section'
      insideMetadataSection = heading.style === 'metadata'
      continue
    }

    const cleanedLine = stripListMarker(sourceLine)
    const isImplicitHeading = looksLikeShoutingHeading(cleanedLine)

    if (isImplicitHeading) {
      pushBlankLine(formattedLines)
      pushFormattedLine(formattedLines, `${titleCaseHeading(cleanedLine)}:`)
      insideAccommodationSection = true
      insideMetadataSection = false
      continue
    }

    const isMetadataOrNote =
      FORM_LABEL_PATTERN.test(cleanedLine)
      || NOTE_PATTERN.test(cleanedLine)
      || insideMetadataSection

    if (insideAccommodationSection && !isMetadataOrNote) {
      pushFormattedLine(formattedLines, `- ${cleanedLine}`)
      continue
    }

    pushFormattedLine(formattedLines, cleanedLine)
  }

  return formattedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
