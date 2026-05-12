import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ACCOMMODATION_PHOTO_LONG_SIDE,
  assessAccommodationDraftHealth,
  getAccommodationImagePrepDecision,
  getAccommodationPhotoRecoveryTileRects,
  mergeAccommodationPhotoRecoveryTileDrafts,
  shouldTriggerAccommodationFocusedRecovery,
} from '../../src/lib/text/accommodationImagePrep.ts'

test('getAccommodationImagePrepDecision normalizes large real-photo style images', () => {
  const decision = getAccommodationImagePrepDecision({
    bytes: 3_800_000,
    dimensions: {
      height: 4000,
      width: 3000,
    },
    mimeType: 'image/jpeg',
  })

  assert.equal(decision.isPhotoMode, true)
  assert.equal(decision.shouldNormalize, true)
  assert.equal(decision.targetLongSide, ACCOMMODATION_PHOTO_LONG_SIDE)
  assert.equal(decision.normalizedMimeType, 'image/jpeg')
})

test('getAccommodationImagePrepDecision keeps smaller synthetic png fixtures unchanged', () => {
  const decision = getAccommodationImagePrepDecision({
    bytes: 176_431,
    dimensions: {
      height: 1600,
      width: 1600,
    },
    mimeType: 'image/png',
  })

  assert.equal(decision.isPhotoMode, false)
  assert.equal(decision.shouldNormalize, false)
})

test('shouldTriggerAccommodationFocusedRecovery flags heading-heavy photo drafts', () => {
  const draft = [
    'MODIFICATIONS needed:',
    'ACCOMMODATIONS',
    'SETTING / SCHEDULING',
    'TEACHER DIRECTIONS',
    'STUDENT RESPONSE',
    'ORGANIZATION / STUDY SKILLS',
  ].join('\n')

  assert.equal(
    shouldTriggerAccommodationFocusedRecovery(draft, {
      isPhotoMode: true,
    }),
    true,
  )

  const health = assessAccommodationDraftHealth(draft)

  assert.equal(health.isHeadingHeavy, true)
  assert.equal(health.lowSignalLineCount, true)
  assert.equal(health.hasModificationsPreamble, true)
})

test('shouldTriggerAccommodationFocusedRecovery skips already-good drafts', () => {
  const draft = [
    'Setting / Scheduling',
    'Test in a small group when requested.',
    'Extended time on tests (2 days).',
    '',
    'Teacher Directions',
    'Frequent checks for understanding.',
    '',
    'Student Response',
    'Use of speech-to-text application.',
  ].join('\n')

  assert.equal(
    shouldTriggerAccommodationFocusedRecovery(draft, {
      isPhotoMode: true,
    }),
    false,
  )
})

test('getAccommodationPhotoRecoveryTileRects returns bounded overlapping and condition tiles', () => {
  const tiles = getAccommodationPhotoRecoveryTileRects({
    height: 1296,
    width: 972,
  })

  assert.equal(tiles.length, 6)
  assert.deepEqual(
    tiles.map((tile) => tile.label),
    [
      'left',
      'middle',
      'right',
      'student_response_conditions',
      'setting_condition_lines',
      'student_response_exception_lines',
    ],
  )

  for (const tile of tiles) {
    assert.ok(tile.width > 0)
    assert.ok(tile.height > 0)
    assert.ok(tile.x >= 0)
    assert.ok(tile.y >= 0)
    assert.ok(tile.x + tile.width <= 972)
    assert.ok(tile.y + tile.height <= 1296)
  }

  assert.ok(tiles[0].x < tiles[1].x)
  assert.ok(tiles[1].x < tiles[2].x)
  assert.ok(tiles[0].x + tiles[0].width > tiles[1].x)
  assert.ok(tiles[1].x + tiles[1].width > tiles[2].x)
  assert.ok(tiles[3].x >= tiles[2].x)
  assert.ok(tiles[3].y <= tiles[2].y)
  assert.ok(tiles[4].x <= tiles[0].x + tiles[0].width)
  assert.ok(tiles[5].x >= tiles[1].x)
  assert.ok(tiles[5].x + tiles[5].width >= tiles[2].x + tiles[2].width)
})

test('mergeAccommodationPhotoRecoveryTileDrafts keeps richer overlapping lines once', () => {
  const merged = mergeAccommodationPhotoRecoveryTileDrafts([
    {
      label: 'left',
      text: [
        'Setting / Scheduling',
        'Extended time on tests',
        'Seat away from distractions.',
      ].join('\n'),
    },
    {
      label: 'middle',
      text: [
        'Setting / Scheduling',
        'Extended time on tests (2 days).',
        'Seat away from distractions.',
      ].join('\n'),
    },
    {
      label: 'right',
      text: [
        'Teacher Directions',
        'Frequent checks for understanding.',
      ].join('\n'),
    },
  ])

  assert.equal(
    merged,
    [
      'Setting / Scheduling',
      'Extended time on tests (2 days).',
      'Seat away from distractions.',
      'Teacher Directions',
      'Frequent checks for understanding.',
    ].join('\n'),
  )
})

test('mergeAccommodationPhotoRecoveryTileDrafts replaces shorter same-accommodation lines with richer condition wording', () => {
  const merged = mergeAccommodationPhotoRecoveryTileDrafts([
    {
      label: 'right',
      text: [
        'SPEECH-TO-TEXT application',
        'No penalty for spelling task',
        'No penalty for grammar unless a grammar task',
      ].join('\n'),
    },
    {
      label: 'student_response_conditions',
      text: [
        'STUDENT RESPONSE',
        'Speech-to-text application',
        'No penalty for spelling except on spelling task',
        'No penalty for grammar unless it is a grammar task',
      ].join('\n'),
    },
  ])

  assert.match(merged, /STUDENT RESPONSE/)
  assert.match(merged, /speech-to-text application/i)
  assert.match(merged, /No penalty for spelling except on spelling task/)
  assert.match(merged, /No penalty for grammar unless it is a grammar task/)
  assert.doesNotMatch(merged, /No penalty for spelling task$/m)
})
