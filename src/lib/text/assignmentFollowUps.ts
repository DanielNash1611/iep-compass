interface AssignmentFollowUpSource {
  accessRelevantDetails?: string[]
  accommodationFocus?: string
  assignmentType?: string
  calculationFocus?: string
  detectedRequirements?: Array<{ text?: string; type?: string }>
  evidenceBullets?: string[]
  followUpQuestions?: string[]
  gradingFactors?: string[]
  subject?: string
  taskDescription?: string
  taskSummary?: string
  timeLimitMinutes?: number | null
  timedStatus?: string
  topic?: string
  visibleDocumentType?: string
  workType?: string
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function uniqueQuestions(questions: string[]) {
  const seen = new Set<string>()

  return questions.filter((question) => {
    const cleaned = question.trim()
    const key = normalizeText(cleaned)

    if (!cleaned || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function toStudentFacingFollowUp(question: string) {
  const cleaned = question.trim()

  if (!cleaned) {
    return ''
  }

  if (/practice.*(?:actual\s+)?quiz|quiz.*practice/i.test(cleaned)) {
    return 'Check whether your accommodations should be matched to this practice work, the actual quiz/test, or both.'
  }

  if (/how many minutes|number of minutes|minutes.*student/i.test(cleaned)) {
    return 'Write how many minutes you have if this task is timed.'
  }

  if (/is this assignment timed/i.test(cleaned)) {
    return 'Check whether this assignment is timed.'
  }

  if (/is this .*timed|is .*task timed|timed\?/i.test(cleaned)) {
    return 'Check whether this task is timed.'
  }

  if (/spelling|grammar|mechanics/i.test(cleaned)) {
    return 'Check whether spelling or grammar counts toward the final score.'
  }

  if (/calculator|calculation/i.test(cleaned)) {
    return 'Check whether this is a calculation test or quiz where calculator use is restricted.'
  }

  return cleaned
    .replace(/^Do you want to check/i, 'Check')
    .replace(/^Should accommodations be checked/i, 'Check whether accommodations should be matched')
    .replace(/^Does\b/i, 'Check whether')
    .replace(/^Is\b/i, 'Check whether')
    .replace(/^Are\b/i, 'Check whether')
    .replace(/\bthe student has\b/i, 'you have')
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function buildAssignmentFollowUpQuestions(source: AssignmentFollowUpSource) {
  const existingQuestions = uniqueQuestions(
    (source.followUpQuestions ?? []).map(toStudentFacingFollowUp),
  )
  const detectedRequirementText = (source.detectedRequirements ?? [])
    .flatMap((requirement) => [requirement.type, requirement.text])
    .filter((value): value is string => Boolean(value))
  const combinedText = normalizeText([
    source.assignmentType,
    source.accommodationFocus,
    source.calculationFocus,
    ...(source.accessRelevantDetails ?? []),
    ...(source.evidenceBullets ?? []),
    ...detectedRequirementText,
    ...(source.gradingFactors ?? []),
    source.subject,
    source.taskDescription,
    source.taskSummary,
    typeof source.timeLimitMinutes === 'number'
      ? `${source.timeLimitMinutes} minutes`
      : undefined,
    source.timedStatus,
    source.topic,
    source.visibleDocumentType,
    source.workType,
  ].filter(Boolean).join(' '))
  const generatedQuestions: string[] = []
  const existingQuestionText = normalizeText(existingQuestions.join(' '))

  if (
    !includesAny(existingQuestionText, ['practice', 'quiz itself', 'actual quiz'])
    && (
      (includesAny(combinedText, ['quiz']) && includesAny(combinedText, ['practice']))
      || (source.visibleDocumentType === 'quiz' && source.workType === 'practice')
      || (source.assignmentType === 'quiz' && source.workType === 'practice')
    )
  ) {
    generatedQuestions.push(
      'Check whether your accommodations should be matched to this practice work, the actual quiz/test, or both.',
    )
  }

  if (
    !includesAny(existingQuestionText, ['timed'])
    && (
      source.timedStatus === 'unknown'
      || source.timeLimitMinutes === null
      || typeof source.timeLimitMinutes === 'undefined'
    )
  ) {
    generatedQuestions.push('Check whether this task is timed.')
  }

  if (
    !includesAny(existingQuestionText, ['how many minutes', 'number of minutes'])
    && source.timedStatus !== 'untimed'
    && (source.timeLimitMinutes === null || typeof source.timeLimitMinutes === 'undefined')
  ) {
    generatedQuestions.push('Write how many minutes you have if this task is timed.')
  }

  if (
    !includesAny(existingQuestionText, ['spelling', 'grammar', 'mechanics'])
    &&
    includesAny(combinedText, ['rubric', 'spelling', 'grammar', 'mechanics'])
    && !includesAny(combinedText, ['spelling does not count', 'grammar does not count'])
  ) {
    generatedQuestions.push('Check whether spelling or grammar counts toward the final score.')
  }

  if (
    !includesAny(existingQuestionText, ['calculator', 'calculation'])
    &&
    includesAny(combinedText, [
      'calculation',
      'calculator',
      'computation',
      'division',
      'multiplication',
      'math_assignment',
    ])
  ) {
    generatedQuestions.push(
      'Check whether this is a calculation test or quiz where calculator use is restricted.',
    )
  }

  return uniqueQuestions([...generatedQuestions, ...existingQuestions]).slice(0, 4)
}
