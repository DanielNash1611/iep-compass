import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isJordanDemoRequest,
  parseSelectedDemoAccommodationIds,
} from '../../src/lib/analysis/demoBrowserMapping.ts'
import {
  createJordanDemoSources,
} from '../../src/data/demoCase.ts'

test('demo browser mapping accepts only allowed accommodation IDs', () => {
  const parsed = parseSelectedDemoAccommodationIds(JSON.stringify({
    relevant: [
      'written_directions',
      'visual_supports',
      'invented_extra_breaks',
      'extended_time',
    ],
  }))

  assert.deepEqual(parsed.selectedIds, [
    'written_directions',
    'visual_supports',
    'extended_time',
  ])
  assert.deepEqual(parsed.rejectedIds, ['invented_extra_breaks'])
})

test('demo browser mapping can recover IDs from non-json text while rejecting inventions', () => {
  const parsed = parseSelectedDemoAccommodationIds(
    'I would pick chunked_steps and multiple_checks, plus imaginary_legal_service.',
  )

  assert.deepEqual(parsed.selectedIds, ['chunked_steps', 'multiple_checks'])
  assert.deepEqual(parsed.rejectedIds, [
    'would',
    'pick',
    'and',
    'plus',
    'imaginary_legal_service',
  ])
})

test('Jordan demo request detection requires seeded demo attachments and the demo task title', () => {
  const demo = createJordanDemoSources()

  assert.equal(
    isJordanDemoRequest({
      contextTags: demo.contextTags,
      iepSource: demo.iepSource,
      learningProfile: demo.learningProfile,
      taskSource: demo.taskSource,
      taskTitle: demo.taskTitle,
      taskTraits: null,
    }),
    true,
  )

  assert.equal(
    isJordanDemoRequest({
      contextTags: demo.contextTags,
      iepSource: {
        attachments: [],
        text: 'Provide written and verbal directions.',
      },
      learningProfile: demo.learningProfile,
      taskSource: demo.taskSource,
      taskTitle: 'Different task',
      taskTraits: null,
    }),
    false,
  )
})
