import test from 'node:test'
import assert from 'node:assert/strict'

import {
  scoreAccommodationEvalCase,
  scoreAssignmentEvalCase,
} from '../evals/image/scoring.ts'

test('scoreAccommodationEvalCase tags lost conditions when accommodation text drops exceptions', () => {
  const result = scoreAccommodationEvalCase({
    evalCase: {
      caseFilePath: '/tmp/exception_language.json',
      expected: {
        conditions: ['except when spelling is directly assessed'],
        expected_accommodations: [
          {
            conditions: ['except when spelling is directly assessed'],
            label_keywords: ['spelling errors'],
            source_evidence_keywords: ['rubric'],
          },
        ],
        must_include_keywords: ['spelling'],
        must_not_include: [],
        requires_uncertainty: false,
      },
      id: 'exception_language',
      image_path: 'fixtures/exception_language.png',
      label: 'Exception language',
      notes: [],
      resolvedImagePath: '/tmp/exception_language.png',
      suite: 'accommodation_upload',
    },
    model: 'gemma4:31b',
    modelResult: {
      output: [
        'Student Information',
        'Student Name: Example Student',
        'Extracted Accommodations Details',
        'Spelling errors do not reduce score.',
        'Speech-to-text is available for longer writing tasks.',
      ].join('\n'),
      rawContent: 'plain text',
      rawJson: undefined,
    },
  })

  assert.equal(result.status, 'failed')
  assert.ok(result.failure_tags.includes('lost_condition'))
})

test('scoreAccommodationEvalCase tags overconfidence for blurry cases', () => {
  const result = scoreAccommodationEvalCase({
    evalCase: {
      caseFilePath: '/tmp/blurry_phone_photo.json',
      expected: {
        conditions: [],
        expected_accommodations: [],
        must_include_keywords: [],
        must_not_include: [],
        requires_uncertainty: true,
      },
      id: 'blurry_phone_photo',
      image_path: 'fixtures/blurry_phone_photo.png',
      label: 'Blurry phone photo',
      notes: [],
      resolvedImagePath: '/tmp/blurry_phone_photo.png',
      suite: 'accommodation_upload',
    },
    model: 'gemma4:31b',
    modelResult: {
      output: [
        'Student Information',
        'Student Name: Example Student',
        'Extracted Accommodations Details',
        'Extended time on tests.',
      ].join('\n'),
      rawContent: 'plain text',
      rawJson: undefined,
    },
  })

  assert.equal(result.metrics.uncertainty_handling_score, 0)
  assert.ok(result.failure_tags.includes('overconfident_on_unclear_text'))
})

test('scoreAccommodationEvalCase accepts [blank] as an uncertainty marker', () => {
  const result = scoreAccommodationEvalCase({
    evalCase: {
      caseFilePath: '/tmp/real_accommodation_page_phone_photo.json',
      expected: {
        conditions: [],
        expected_accommodations: [],
        must_include_keywords: ['Student Information', 'Student Name'],
        must_not_include: [],
        requires_uncertainty: true,
      },
      id: 'real_accommodation_page_phone_photo',
      image_path: 'fixtures/real_accommodation_page_phone_photo.jpg',
      label: 'Real accommodations page phone photo',
      notes: [],
      resolvedImagePath: '/tmp/real_accommodation_page_phone_photo.jpg',
      suite: 'accommodation_upload',
    },
    model: 'gemma4:31b',
    modelResult: {
      output: [
        'Student Information',
        'Student Name: [blank]',
        'Date of Birth: [blank]',
        'Extracted Accommodations Details',
      ].join('\n'),
      rawContent: 'plain text',
      rawJson: undefined,
    },
  })

  assert.equal(result.metrics.uncertainty_handling_score, 1)
  assert.ok(!result.failure_tags.includes('overconfident_on_unclear_text'))
})

test('scoreAccommodationEvalCase accepts "partly cut off" as an uncertainty marker', () => {
  const result = scoreAccommodationEvalCase({
    evalCase: {
      caseFilePath: '/tmp/blurry_phone_photo.json',
      expected: {
        conditions: [],
        expected_accommodations: [],
        must_include_keywords: ['Accommodation Summary'],
        must_not_include: [],
        requires_uncertainty: true,
      },
      id: 'blurry_phone_photo',
      image_path: 'fixtures/blurry_phone_photo.png',
      label: 'Blurry phone photo',
      notes: [],
      resolvedImagePath: '/tmp/blurry_phone_photo.png',
      suite: 'accommodation_upload',
    },
    model: 'gemma4:31b',
    modelResult: {
      output: [
        'Accommodation Summary',
        'Speech-to-text may be used for long written responses.',
        'Teacher notes on page edge are partly cut off.',
      ].join('\n'),
      rawContent: 'plain text',
      rawJson: undefined,
    },
  })

  assert.equal(result.metrics.uncertainty_handling_score, 1)
  assert.ok(!result.failure_tags.includes('overconfident_on_unclear_text'))
})

test('scoreAssignmentEvalCase tags missed deadline and wrong assignment type', () => {
  const result = scoreAssignmentEvalCase({
    evalCase: {
      caseFilePath: '/tmp/math_assignment.json',
      expected: {
        assignment_type: 'math_assignment',
        document_type: 'assignment_page',
        must_detect_grading_factors: [],
        must_detect_requirements: [
          {
            text_keywords: ['tomorrow'],
            type: 'deadline',
          },
        ],
        must_include_keywords: ['long division'],
        must_not_include: [],
        requires_uncertainty: false,
      },
      id: 'math_assignment',
      image_path: 'fixtures/math_assignment.png',
      label: 'Math assignment',
      notes: [],
      resolvedImagePath: '/tmp/math_assignment.png',
      suite: 'assignment_upload',
    },
    model: 'gemma4:31b',
    modelResult: {
      output: {
        assignment_type: 'worksheet',
        confidence: 0.85,
        detected_requirements: [
          {
            text: 'Solve 12 long division problems.',
            type: 'math_computation',
          },
        ],
        document_type: 'assignment_page',
        grading_factors: [],
        must_ask_for_more_context: false,
        task_summary: 'Solve long division problems.',
      },
      rawContent: '{}',
      rawJson: {},
    },
  })

  assert.equal(result.status, 'failed')
  assert.ok(result.failure_tags.includes('wrong_assignment_type'))
  assert.ok(result.failure_tags.includes('missed_deadline'))
})

test('scoreAssignmentEvalCase flags incomplete-image handling failures', () => {
  const result = scoreAssignmentEvalCase({
    evalCase: {
      caseFilePath: '/tmp/partially_cropped_instructions.json',
      expected: {
        assignment_type: 'project',
        document_type: 'assignment_page',
        must_detect_grading_factors: [],
        must_detect_requirements: [],
        must_include_keywords: ['science project'],
        must_not_include: [],
        requires_uncertainty: true,
      },
      id: 'partially_cropped_instructions',
      image_path: 'fixtures/partially_cropped_instructions.png',
      label: 'Partially cropped instructions',
      notes: [],
      resolvedImagePath: '/tmp/partially_cropped_instructions.png',
      suite: 'assignment_upload',
    },
    model: 'gemma4:31b',
    modelResult: {
      output: {
        assignment_type: 'project',
        confidence: 0.89,
        detected_requirements: [],
        document_type: 'assignment_page',
        grading_factors: [],
        must_ask_for_more_context: false,
        task_summary: 'Science project instructions.',
      },
      rawContent: '{}',
      rawJson: {},
    },
  })

  assert.equal(result.metrics.incomplete_image_handling_score, 0)
  assert.ok(result.failure_tags.includes('failed_to_flag_incomplete_image'))
})

test('scoreAssignmentEvalCase checks follow-up questions', () => {
  const result = scoreAssignmentEvalCase({
    evalCase: {
      caseFilePath: '/tmp/essay_rubric_spelling.json',
      expected: {
        assignment_type: 'essay',
        document_type: 'assignment_rubric',
        must_ask_follow_up_questions: [
          {
            text_keywords: ['timed'],
          },
          {
            text_keywords: ['spelling'],
          },
        ],
        must_detect_grading_factors: ['spelling'],
        must_detect_requirements: [],
        must_include_keywords: ['ecosystems'],
        must_not_include: [],
        requires_uncertainty: false,
      },
      id: 'essay_rubric_spelling',
      image_path: 'fixtures/essay_rubric_spelling.png',
      label: 'Essay rubric',
      notes: [],
      resolvedImagePath: '/tmp/essay_rubric_spelling.png',
      suite: 'assignment_upload',
    },
    model: 'gemma4:31b',
    modelResult: {
      output: {
        access_relevant_details: ['Rubric includes spelling'],
        assignment_type: 'essay',
        confidence: 0.86,
        detected_requirements: [],
        document_type: 'assignment_rubric',
        follow_up_questions: ['Does spelling count toward the final score?'],
        grading_factors: ['spelling'],
        must_ask_for_more_context: false,
        task_summary: 'Write an essay about ecosystems.',
      },
      rawContent: '{}',
      rawJson: {},
    },
  })

  assert.equal(result.status, 'failed')
  assert.ok(result.failure_tags.includes('missed_follow_up_question'))
})
