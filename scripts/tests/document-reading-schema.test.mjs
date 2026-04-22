import test from 'node:test'
import assert from 'node:assert/strict'

import { parseJsonFromModelOutput } from '../../src/lib/model/structuredOutput.ts'
import { parseDocumentReadingResult } from '../../src/lib/schema/ocrSchema.ts'

test('parseDocumentReadingResult normalizes common IEP documentKind aliases', () => {
  const result = parseDocumentReadingResult({
    confidenceFlags: {
      containsUnclearText: false,
      isPartialDocument: false,
      lowConfidence: false,
    },
    documentKind: 'iep',
    notes: [],
    rawTranscript: 'sample',
    reviewDraft: {
      district: '',
      dob: '',
      learningDisabilityOrProfileText: [],
      meetingDate: '',
      modifications: [],
      sections: [],
      sourceSummaryText: '',
      studentName: '',
    },
  })

  assert.equal(result.documentKind, 'iep_accommodations')
})

test('parseDocumentReadingResult infers documentKind from review draft shape when missing', () => {
  const result = parseDocumentReadingResult({
    confidenceFlags: {
      containsUnclearText: false,
      isPartialDocument: false,
      lowConfidence: false,
    },
    notes: [],
    rawTranscript: 'sample',
    reviewDraft: {
      calculationFocus: 'mixed_or_unknown',
      evidenceBullets: [],
      sourceSummaryText: '',
      subject: '',
      taskDescription: 'math quiz practice sheet on geometry',
      timedStatus: 'unknown',
      topic: '',
      workType: 'quiz',
    },
  })

  assert.equal(result.documentKind, 'assignment_or_quiz')
  assert.equal(result.reviewDraft.visibleDocumentType, 'unknown')
  assert.equal(result.reviewDraft.accommodationFocus, 'unknown')
  assert.equal(result.reviewDraft.timeLimitMinutes, null)
  assert.deepEqual(result.reviewDraft.accessRelevantDetails, [])
  assert.deepEqual(result.reviewDraft.followUpQuestions, [
    'Check whether your accommodations should be matched to this practice work, the actual quiz/test, or both.',
    'Check whether this task is timed.',
    'Write how many minutes you have if this task is timed.',
  ])
})

test('parseDocumentReadingResult preserves assignment image follow-up fields', () => {
  const result = parseDocumentReadingResult({
    confidenceFlags: {
      containsUnclearText: false,
      isPartialDocument: false,
      lowConfidence: false,
    },
    documentKind: 'assignment',
    notes: [],
    rawTranscript: 'sample',
    reviewDraft: {
      accessRelevantDetails: ['Rubric includes spelling'],
      accommodationFocus: 'assignment',
      calculationFocus: 'mixed_or_unknown',
      evidenceBullets: ['Rubric row says spelling counts'],
      followUpQuestions: ['Is this assignment timed?'],
      sourceSummaryText: '',
      subject: 'ELA',
      taskDescription: 'Write an essay using the rubric.',
      timeLimitMinutes: null,
      timedStatus: 'unknown',
      topic: '',
      visibleDocumentType: 'rubric',
      workType: 'classwork',
    },
  })

  assert.equal(result.documentKind, 'assignment_or_quiz')
  assert.equal(result.reviewDraft.visibleDocumentType, 'rubric')
  assert.deepEqual(result.reviewDraft.accessRelevantDetails, ['Rubric includes spelling'])
  assert.deepEqual(result.reviewDraft.followUpQuestions, [
    'Write how many minutes you have if this task is timed.',
    'Check whether spelling or grammar counts toward the final score.',
    'Check whether this assignment is timed.',
  ])
})

test('parseDocumentReadingResult asks for quiz-practice focus and time limit', () => {
  const result = parseDocumentReadingResult({
    confidenceFlags: {
      containsUnclearText: false,
      isPartialDocument: false,
      lowConfidence: false,
    },
    documentKind: 'assignment',
    notes: [],
    rawTranscript: '8-3-8-4 Quiz Practice. Areas of Circles and Composite Figures.',
    reviewDraft: {
      accessRelevantDetails: [
        'Page is labeled Quiz Practice',
        'Handwritten note suggests 30 min but timing should be confirmed',
      ],
      calculationFocus: 'calculation_focused',
      evidenceBullets: [
        'Find the area of the circle',
        'Find the area of the semicircle',
      ],
      followUpQuestions: [],
      sourceSummaryText: '',
      subject: 'Math',
      taskDescription:
        '8-3-8-4 Quiz Practice on areas of circles and composite figures.',
      timedStatus: 'unknown',
      topic: 'Area of circles and composite figures',
      visibleDocumentType: 'quiz',
      workType: 'practice',
    },
  })

  assert.equal(result.documentKind, 'assignment_or_quiz')
  assert.equal(result.reviewDraft.accommodationFocus, 'unknown')
  assert.equal(result.reviewDraft.timeLimitMinutes, null)
  assert.match(
    result.reviewDraft.followUpQuestions.join(' '),
    /your accommodations.*practice work.*actual quiz\/test/i,
  )
  assert.match(result.reviewDraft.followUpQuestions.join(' '), /timed/i)
  assert.match(result.reviewDraft.followUpQuestions.join(' '), /minutes/i)
})

test('parseDocumentReadingResult fills safe defaults for partial responses', () => {
  const result = parseDocumentReadingResult({
    documentKind: 'unknown',
    reviewDraft: {},
  })

  assert.deepEqual(result.confidenceFlags, {
    containsUnclearText: false,
    isPartialDocument: false,
    lowConfidence: true,
  })
  assert.deepEqual(result.notes, [])
  assert.equal(result.rawTranscript, '')
  assert.deepEqual(result.reviewDraft.evidenceBullets, [])
  assert.equal(result.reviewDraft.summary, '')
})

test('parseDocumentReadingResult normalizes e2b-style wrapped snake_case output', () => {
  const rawModelText = [
    'Here is the structured result:',
    '```json',
    JSON.stringify({
      result: {
        confidence_flags: {
          contains_unclear_text: true,
          is_partial_document: false,
          low_confidence: false,
        },
        document_kind: 'assignment',
        notes: ['Review timing with staff.'],
        raw_transcript: '8-3-8-4 Quiz Practice\nAreas of Circles',
        review_draft: {
          access_relevant_details: ['Visible page says Quiz Practice.'],
          accommodation_focus: 'practice',
          calculation_focus: 'calculation_focused',
          evidence_bullets: ['Areas of Circles'],
          follow_up_questions: ['How many minutes does the student have?'],
          source_summary_text: 'Quiz practice page about circles.',
          subject: 'Math',
          task_description: 'Quiz practice page about areas of circles.',
          time_limit_minutes: '30',
          timed_status: 'unknown',
          topic: 'Areas of circles',
          visible_document_type: 'quiz',
          work_type: 'practice',
        },
      },
    }),
    '```',
  ].join('\n')

  const result = parseDocumentReadingResult(parseJsonFromModelOutput(rawModelText))

  assert.equal(result.documentKind, 'assignment_or_quiz')
  assert.equal(result.confidenceFlags.containsUnclearText, true)
  assert.equal(result.rawTranscript, '8-3-8-4 Quiz Practice\nAreas of Circles')
  assert.equal(result.reviewDraft.taskDescription, 'Quiz practice page about areas of circles.')
  assert.equal(result.reviewDraft.timeLimitMinutes, 30)
  assert.equal(result.reviewDraft.accommodationFocus, 'practice')
  assert.deepEqual(result.reviewDraft.accessRelevantDetails, [
    'Visible page says Quiz Practice.',
  ])
  assert.match(result.reviewDraft.followUpQuestions.join(' '), /minutes/i)
})
