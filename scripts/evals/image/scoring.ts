import type {
  AssignmentUploadInterpretation,
} from '../../../src/lib/schema/imageInterpretationSchema.ts'
import { hasUncertaintyMarkers } from '../../../src/lib/text/uncertaintyMarkers.ts'
import type {
  AccommodationImageEvalCaseResult,
  AssignmentImageEvalCaseResult,
  EvalCheckResult,
  EvalScoreBlock,
  ImageEvalCaseResult,
  ImageEvalFailureTag,
  LoadedAccommodationUploadEvalCase,
  LoadedAssignmentUploadEvalCase,
  ModelInterpretationResult,
} from './types.ts'

const FIELD_PASS_THRESHOLD = 0.8

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function includesKeyword(haystack: string, needle: string) {
  return normalizeText(haystack).includes(normalizeText(needle))
}

function includesAllKeywords(haystack: string, keywords: string[]) {
  return keywords.every((keyword) => includesKeyword(haystack, keyword))
}

function buildScoreBlock(checks: EvalCheckResult[], threshold = 1): EvalScoreBlock {
  const totalChecks = checks.length || 1
  const passedChecks = checks.filter((check) => check.passed).length
  const score = passedChecks / totalChecks

  return {
    checks,
    passed: score >= threshold,
    score,
  }
}

function buildAssignmentText(output: AssignmentUploadInterpretation) {
  return [
    ...(output.access_relevant_details ?? []),
    output.document_type,
    output.assignment_type,
    output.task_summary,
    ...(output.follow_up_questions ?? []),
    ...output.grading_factors,
    ...output.detected_requirements.flatMap((item) => [item.type, item.text]),
  ].join('\n')
}

function matchAccommodationByKeywords(
  outputText: string,
  expected: LoadedAccommodationUploadEvalCase['expected']['expected_accommodations'][number],
) {
  const expectedKeywords = [
    ...expected.label_keywords,
    ...expected.source_evidence_keywords,
  ]

  return expectedKeywords.length === 0 || includesAllKeywords(outputText, expectedKeywords)
}

function matchRequirement(
  output: AssignmentUploadInterpretation,
  expected: LoadedAssignmentUploadEvalCase['expected']['must_detect_requirements'][number],
) {
  return output.detected_requirements.find((item) => {
    if (item.type !== expected.type) {
      return false
    }

    return expected.text_keywords.length === 0 || includesAllKeywords(item.text, expected.text_keywords)
  })
}

function matchFollowUpQuestion(
  output: AssignmentUploadInterpretation,
  expected: LoadedAssignmentUploadEvalCase['expected']['must_ask_follow_up_questions'][number],
) {
  return (output.follow_up_questions ?? []).find((question) =>
    expected.text_keywords.length === 0
      || includesAllKeywords(question, expected.text_keywords),
  )
}

function calculateConditionMetric(checks: EvalCheckResult[]) {
  if (checks.length === 0) {
    return null
  }

  return checks.filter((check) => check.passed).length / checks.length
}

function hasTag(tags: ImageEvalFailureTag[], tag: ImageEvalFailureTag) {
  return tags.includes(tag)
}

function isLikelyJson(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

export function scoreAccommodationEvalCase(options: {
  evalCase: LoadedAccommodationUploadEvalCase
  model: string
  modelResult: ModelInterpretationResult<string>
}): AccommodationImageEvalCaseResult {
  const failureTags = new Set<ImageEvalFailureTag>()
  const deterministicChecks: EvalCheckResult[] = []

  if (!('output' in options.modelResult)) {
    deterministicChecks.push({
      details: options.modelResult.parseError || 'The model output could not be parsed.',
      key: 'valid_structured_json',
      passed: false,
    })
    failureTags.add('ocr_failure')

    return {
      case: options.evalCase,
      deterministic: buildScoreBlock(deterministicChecks),
      diagnostics: options.modelResult.diagnostics,
      failure_tags: Array.from(failureTags),
      field: buildScoreBlock([], FIELD_PASS_THRESHOLD),
      judge: null,
      metrics: {
        condition_preservation_score: null,
        field_score: 0,
        hallucination_flagged: 0,
        incomplete_image_handling_score: null,
        uncertainty_handling_score: options.evalCase.expected.requires_uncertainty ? 0 : 1,
      },
      model: options.model,
      parse_error: options.modelResult.parseError,
      raw_content: options.modelResult.rawContent,
      raw_json: options.modelResult.rawJson,
      status: 'failed',
    }
  }

  const output = options.modelResult.output
  const outputText = output.trim()

  deterministicChecks.push({
    details: `length=${outputText.length}`,
    key: 'plain_text_present',
    passed: outputText.length > 0,
  })
  deterministicChecks.push({
    details: 'Accommodation extraction should now return plain text, not JSON.',
    key: 'plain_text_not_json',
    passed: !isLikelyJson(outputText),
  })

  const fieldChecks: EvalCheckResult[] = []
  const conditionChecks: EvalCheckResult[] = []

  for (const expectedAccommodation of options.evalCase.expected.expected_accommodations) {
    fieldChecks.push({
      details: [
        ...expectedAccommodation.label_keywords,
        ...expectedAccommodation.source_evidence_keywords,
      ].join(', '),
      key: `accommodation_${expectedAccommodation.normalized_type || 'text'}_found`,
      passed: matchAccommodationByKeywords(outputText, expectedAccommodation),
    })

    if (!matchAccommodationByKeywords(outputText, expectedAccommodation)) {
      failureTags.add('missed_accommodation')
      continue
    }

    for (const condition of expectedAccommodation.conditions) {
      const conditionPresent = includesKeyword(outputText, condition)

      conditionChecks.push({
        details: condition,
        key: `condition_${expectedAccommodation.normalized_type}_${condition}`,
        passed: conditionPresent,
      })

      if (!conditionPresent) {
        failureTags.add('lost_condition')
      }
    }
  }

  for (const condition of options.evalCase.expected.conditions) {
    const conditionPresent = includesKeyword(outputText, condition)

    conditionChecks.push({
      details: condition,
      key: `expected_condition_${condition}`,
      passed: conditionPresent,
    })

    if (!conditionPresent) {
      failureTags.add('lost_condition')
    }
  }

  for (const keyword of options.evalCase.expected.must_include_keywords) {
    const present = includesKeyword(outputText, keyword)

    fieldChecks.push({
      details: keyword,
      key: `must_include_${keyword}`,
      passed: present,
    })

    if (!present) {
      failureTags.add('ocr_failure')
    }
  }

  for (const keyword of options.evalCase.expected.must_not_include) {
    const absent = !includesKeyword(outputText, keyword)

    fieldChecks.push({
      details: keyword,
      key: `must_not_include_${keyword}`,
      passed: absent,
    })

    if (!absent) {
      failureTags.add('hallucinated_accommodation')
    }
  }

  const uncertaintyHandled = options.evalCase.expected.requires_uncertainty
    ? hasUncertaintyMarkers(outputText)
    : true

  fieldChecks.push({
    details: 'Expected a cautious uncertainty marker in the extracted text.',
    key: 'uncertainty_handling',
    passed: uncertaintyHandled,
  })

  if (!uncertaintyHandled) {
    failureTags.add('overconfident_on_unclear_text')
  }

  const deterministic = buildScoreBlock(deterministicChecks)
  const field = buildScoreBlock(fieldChecks.concat(conditionChecks), FIELD_PASS_THRESHOLD)
  const criticalFailureTags: ImageEvalFailureTag[] = [
    'hallucinated_accommodation',
    'lost_condition',
    'missed_accommodation',
    'ocr_failure',
    'overconfident_on_unclear_text',
  ]
  const passed =
    deterministic.passed
    && field.passed
    && criticalFailureTags.every((tag) => !hasTag(Array.from(failureTags), tag))

  return {
    case: options.evalCase,
    deterministic,
    diagnostics: options.modelResult.diagnostics,
    failure_tags: Array.from(failureTags),
    field,
    judge: null,
    metrics: {
      condition_preservation_score: calculateConditionMetric(conditionChecks),
      field_score: field.score,
      hallucination_flagged: failureTags.has('hallucinated_accommodation') ? 1 : 0,
      incomplete_image_handling_score: null,
      uncertainty_handling_score: uncertaintyHandled ? 1 : 0,
    },
    model: options.model,
    output,
    raw_content: options.modelResult.rawContent,
    raw_json: options.modelResult.rawJson,
    status: passed ? 'passed' : 'failed',
  }
}

export function scoreAssignmentEvalCase(options: {
  evalCase: LoadedAssignmentUploadEvalCase
  model: string
  modelResult: ModelInterpretationResult<AssignmentUploadInterpretation>
}): AssignmentImageEvalCaseResult {
  const failureTags = new Set<ImageEvalFailureTag>()
  const deterministicChecks: EvalCheckResult[] = []

  if (!('output' in options.modelResult)) {
    deterministicChecks.push({
      details: options.modelResult.parseError || 'The model output could not be parsed.',
      key: 'valid_structured_json',
      passed: false,
    })
    failureTags.add('ocr_failure')

    return {
      case: options.evalCase,
      deterministic: buildScoreBlock(deterministicChecks),
      diagnostics: options.modelResult.diagnostics,
      failure_tags: Array.from(failureTags),
      field: buildScoreBlock([], FIELD_PASS_THRESHOLD),
      judge: null,
      metrics: {
        condition_preservation_score: null,
        field_score: 0,
        hallucination_flagged: 0,
        incomplete_image_handling_score: options.evalCase.expected.requires_uncertainty ? 0 : null,
        uncertainty_handling_score: options.evalCase.expected.requires_uncertainty ? 0 : 1,
      },
      model: options.model,
      parse_error: options.modelResult.parseError,
      raw_content: options.modelResult.rawContent,
      raw_json: options.modelResult.rawJson,
      status: 'failed',
    }
  }

  const output = options.modelResult.output
  const outputText = buildAssignmentText(output)

  deterministicChecks.push({
    key: 'valid_structured_json',
    passed: true,
  })
  deterministicChecks.push({
    key: 'required_fields_present',
    passed:
      output.task_summary.trim().length > 0
      && output.detected_requirements.every((item) => item.text.trim().length > 0),
  })
  deterministicChecks.push({
    key: 'confidence_in_range',
    passed: output.confidence >= 0 && output.confidence <= 1,
  })

  const fieldChecks: EvalCheckResult[] = []

  const documentTypeMatch = output.document_type === options.evalCase.expected.document_type
  fieldChecks.push({
    details: `expected ${options.evalCase.expected.document_type}, received ${output.document_type}`,
    key: 'document_type_match',
    passed: documentTypeMatch,
  })

  if (!documentTypeMatch) {
    failureTags.add('ocr_failure')
  }

  const assignmentTypeMatch = output.assignment_type === options.evalCase.expected.assignment_type
  fieldChecks.push({
    details: `expected ${options.evalCase.expected.assignment_type}, received ${output.assignment_type}`,
    key: 'assignment_type_match',
    passed: assignmentTypeMatch,
  })

  if (!assignmentTypeMatch) {
    failureTags.add('wrong_assignment_type')
  }

  for (const expectedRequirement of options.evalCase.expected.must_detect_requirements) {
    const matchedRequirement = matchRequirement(output, expectedRequirement)

    fieldChecks.push({
      details: `expected ${expectedRequirement.type}`,
      key: `requirement_${expectedRequirement.type}`,
      passed: Boolean(matchedRequirement),
    })

    if (!matchedRequirement) {
      if (expectedRequirement.type === 'deadline') {
        failureTags.add('missed_deadline')
      } else {
        failureTags.add('missed_accommodation_relevant_signal')
      }
    }
  }

  for (const factor of options.evalCase.expected.must_detect_grading_factors) {
    const foundFactor = output.grading_factors.some((item) => includesKeyword(item, factor))

    fieldChecks.push({
      details: factor,
      key: `grading_factor_${factor}`,
      passed: foundFactor,
    })

    if (!foundFactor) {
      failureTags.add('missed_rubric_factor')
    }
  }

  for (const expectedQuestion of (
    options.evalCase.expected.must_ask_follow_up_questions ?? []
  )) {
    const matchedQuestion = matchFollowUpQuestion(output, expectedQuestion)

    fieldChecks.push({
      details: expectedQuestion.text_keywords.join(', '),
      key: `follow_up_question_${expectedQuestion.text_keywords.join('_')}`,
      passed: Boolean(matchedQuestion),
    })

    if (!matchedQuestion) {
      failureTags.add('missed_follow_up_question')
    }
  }

  for (const keyword of options.evalCase.expected.must_include_keywords) {
    const present = includesKeyword(outputText, keyword)

    fieldChecks.push({
      details: keyword,
      key: `must_include_${keyword}`,
      passed: present,
    })

    if (!present) {
      failureTags.add('ocr_failure')
    }
  }

  for (const keyword of options.evalCase.expected.must_not_include) {
    const absent = !includesKeyword(outputText, keyword)

    fieldChecks.push({
      details: keyword,
      key: `must_not_include_${keyword}`,
      passed: absent,
    })

    if (!absent) {
      failureTags.add('hallucinated_requirement')
    }
  }

  const uncertaintyHandled = options.evalCase.expected.requires_uncertainty
    ? output.must_ask_for_more_context || output.confidence <= 0.7
    : true

  fieldChecks.push({
    details: `confidence=${output.confidence}; must_ask_for_more_context=${output.must_ask_for_more_context}`,
    key: 'uncertainty_handling',
    passed: uncertaintyHandled,
  })

  if (!uncertaintyHandled) {
    failureTags.add('failed_to_flag_incomplete_image')
  }

  const deterministic = buildScoreBlock(deterministicChecks)
  const field = buildScoreBlock(fieldChecks, FIELD_PASS_THRESHOLD)
  const criticalFailureTags: ImageEvalFailureTag[] = [
    'failed_to_flag_incomplete_image',
    'hallucinated_requirement',
    'missed_accommodation_relevant_signal',
    'missed_deadline',
    'missed_follow_up_question',
    'missed_rubric_factor',
    'wrong_assignment_type',
  ]
  const passed =
    deterministic.passed
    && field.passed
    && criticalFailureTags.every((tag) => !hasTag(Array.from(failureTags), tag))

  return {
    case: options.evalCase,
    deterministic,
    diagnostics: options.modelResult.diagnostics,
    failure_tags: Array.from(failureTags),
    field,
    judge: null,
    metrics: {
      condition_preservation_score: null,
      field_score: field.score,
      hallucination_flagged: failureTags.has('hallucinated_requirement') ? 1 : 0,
      incomplete_image_handling_score: options.evalCase.expected.requires_uncertainty
        ? (uncertaintyHandled ? 1 : 0)
        : null,
      uncertainty_handling_score: uncertaintyHandled ? 1 : 0,
    },
    model: options.model,
    output,
    raw_content: options.modelResult.rawContent,
    raw_json: options.modelResult.rawJson,
    status: passed ? 'passed' : 'failed',
  }
}

export function applyJudgeResult(
  caseResult: ImageEvalCaseResult,
  judgeResult: ImageEvalCaseResult['judge'],
): ImageEvalCaseResult {
  if (!judgeResult || judgeResult.pass === null) {
    return {
      ...caseResult,
      judge: judgeResult,
    }
  }

  const mergedFailureTags = Array.from(
    new Set(caseResult.failure_tags.concat(judgeResult.suggested_failure_tags)),
  )

  return {
    ...caseResult,
    failure_tags: mergedFailureTags,
    judge: judgeResult,
    status:
      caseResult.status === 'passed' && judgeResult.pass
        ? 'passed'
        : 'failed',
  }
}
