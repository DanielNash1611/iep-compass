import test from 'node:test'
import assert from 'node:assert/strict'

import { parseAnalysisResult } from '../../src/lib/schema/analysisSchema.ts'

test('parseAnalysisResult rejects blank guidance that would render as an empty result', () => {
  assert.throws(() =>
    parseAnalysisResult({
      boundaries: ['Only use approved accommodations.'],
      notObviouslyRelevant: [],
      parentGuidance: {
        coachNotes: [],
        summary: '',
      },
      relevantAccommodations: [],
      studentGuidance: {
        alternativeScripts: [],
        startHere: '',
        suggestedScript: '',
      },
      teacherGuidance: {
        staffNotes: [],
        summary: '',
      },
    }),
  )
})

test('parseAnalysisResult accepts complete nonblank guidance', () => {
  const result = parseAnalysisResult({
    boundaries: ['Only use approved accommodations.'],
    notObviouslyRelevant: [],
    parentGuidance: {
      coachNotes: ['Keep the student in the lead.'],
      summary: 'The student can ask for the setup before starting.',
    },
    relevantAccommodations: [],
    studentGuidance: {
      alternativeScripts: ['Can we check my IEP supports before I start?'],
      startHere: 'Nothing is a clear match yet, so start by confirming the task setup.',
      suggestedScript: 'Can we check which accommodations fit this task?',
    },
    teacherGuidance: {
      staffNotes: ['Confirm timing and setting first.'],
      summary: 'Keep the check tied to the approved IEP wording.',
    },
  })

  assert.match(result.studentGuidance.startHere, /confirming the task setup/)
})
