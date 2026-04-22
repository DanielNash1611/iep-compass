import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAccommodationConsolidationPrompt,
  buildAccommodationExtractionPrompt,
  buildAccommodationFocusedExtractionPrompt,
} from '../../src/lib/text/accommodationExtractionPrompt.ts'
import { selectAccommodationDraft } from '../../src/lib/text/accommodationDraftSelection.ts'
import { formatAccommodationReviewText } from '../../src/lib/text/accommodationReviewFormatting.ts'

test('buildAccommodationExtractionPrompt includes the direct-paste structure and uncertainty markers', () => {
  const prompt = buildAccommodationExtractionPrompt({
    attachmentKind: 'image',
    attachmentName: 'accommodations.jpg',
  })

  assert.match(prompt, /This image comes from the uploaded image file "accommodations\.jpg"\./)
  assert.match(prompt, /If the page shows both MODIFICATIONS and ACCOMMODATIONS, copy the accommodations text and ignore the modifications text unless it directly changes the accommodation wording\./)
  assert.match(prompt, /If a page includes Accommodations plus Goals, Services, or Notes, copy the Accommodations section and ignore the other sections unless they directly change the accommodation wording\./)
  assert.match(prompt, /Student Information/)
  assert.match(prompt, /Extracted Accommodations Details/)
  assert.match(prompt, /If headings are visible but the lines under them are faint, copy the readable words under those headings and use \[unclear\] for the missing words instead of stopping at the heading\./)
  assert.match(prompt, /Prioritize accommodation lines over form instructions, explanatory preamble, or repeated section labels\./)
  assert.match(prompt, /\[unclear\], \[blank\], or \[redacted\]/)
  assert.match(prompt, /Important: the example below only shows format\. Do not copy any accommodation line from the example unless that wording is actually visible in the image\./)
  assert.match(prompt, /If the page is shorter and only shows one visible heading like "Writing accommodations"/)
  assert.match(prompt, /Use of a calculator \(except for calculation tests\)\./)
})

test('buildAccommodationFocusedExtractionPrompt stays section-focused and lightweight', () => {
  const prompt = buildAccommodationFocusedExtractionPrompt({
    attachmentKind: 'image',
    attachmentName: 'accommodations.jpg',
  })

  assert.match(prompt, /short accommodation snippet/i)
  assert.match(prompt, /copy only visible document text lines/i)
  assert.match(prompt, /do not add example accommodations/i)
  assert.match(prompt, /ignore the modifications wording unless it directly changes an accommodation line/i)
  assert.match(prompt, /Ignore goals, services, form instructions, and repeated section labels unless they are part of a visible accommodation line\./)
  assert.match(prompt, /If a heading is visible but the line under it is faint, keep the readable words and use \[unclear\] for the rest\./)
  assert.match(prompt, /If a word is hard to read, use \[unclear\]\./)
  assert.doesNotMatch(prompt, /Use of a calculator \(except for calculation tests\)\./)
})

test('buildAccommodationFocusedExtractionPrompt can focus on condition wording in a narrow student-response crop', () => {
  const prompt = buildAccommodationFocusedExtractionPrompt({
    attachmentKind: 'image',
    attachmentName: 'accommodations.jpg',
  }, {
    conditionFocus: true,
    photoMode: true,
  })

  assert.match(prompt, /Student Response accommodation rows/i)
  assert.match(prompt, /may show only one narrow column or a few short lines/i)
  assert.match(prompt, /Do not return only the heading when filled Student Response lines are visible\./)
  assert.match(prompt, /Preserve condition wording exactly/i)
  assert.match(prompt, /when requested," "except on," "unless," and "except for/i)
  assert.match(prompt, /Ignore neighboring columns, blank rows, and modifications text/i)
})

test('photo-mode accommodation prompts stay rotation-aware and boilerplate-averse', () => {
  const fullPrompt = buildAccommodationExtractionPrompt({
    attachmentKind: 'image',
    attachmentName: 'phone-photo.jpg',
  }, {
    photoMode: true,
  })
  const focusedPrompt = buildAccommodationFocusedExtractionPrompt({
    attachmentKind: 'image',
    attachmentName: 'phone-photo.jpg',
  }, {
    photoMode: true,
  })

  assert.match(fullPrompt, /page may be sideways or rotated/i)
  assert.match(fullPrompt, /Ignore the MODIFICATIONS paragraph, grading boxes, empty "None" rows, blank table cells/i)
  assert.match(fullPrompt, /Prioritize the filled ACCOMMODATIONS rows over explanatory preamble or empty table structure\./)
  assert.doesNotMatch(fullPrompt, /Use of a calculator \(except for calculation tests\)\./)

  assert.match(focusedPrompt, /phone photo may be sideways or rotated/i)
  assert.match(focusedPrompt, /Ignore the MODIFICATIONS paragraph, goals, services, grading boxes, empty "None" rows, blank table cells/i)
  assert.match(focusedPrompt, /Prioritize the filled ACCOMMODATIONS rows over boilerplate instructions or empty table structure\./)
})

test('buildAccommodationConsolidationPrompt asks for literal merge behavior', () => {
  const prompt = buildAccommodationConsolidationPrompt([
    'Draft line one',
    'Draft line two',
  ])

  assert.match(prompt, /Use only wording supported by the drafts below\./)
  assert.match(prompt, /Do not invent new accommodations\./)
  assert.match(prompt, /Draft 1:\nDraft line one/)
  assert.match(prompt, /Draft 2:\nDraft line two/)
})

test('selectAccommodationDraft prefers the structured draft for dense real-form sections', () => {
  const structured = [
    'Setting / Scheduling',
    'Test in a small group when requested.',
    'Extended time on tests (2 days).',
    '',
    'Teacher Directions',
    'Frequent checks for understanding.',
  ].join('\n')
  const focused = [
    "The accommodations provided by the school or district",
    "are listed below for the student's benefit.",
  ].join('\n')

  assert.equal(selectAccommodationDraft([structured, focused]), structured)
})

test('selectAccommodationDraft avoids structured short-page leakage when the focused draft is cleaner', () => {
  const structured = [
    'Use of speech-to-text application',
    'No penalty for spelling (except on spelling tasks).',
    'No penalty for grammar (unless it is a grammar task).',
    'Use of a calculator (except for calculation tests).',
    'Use of a multiplication chart.',
  ].join('\n')
  const focused = [
    'Writing accommodations',
    'Spelling errors will not reduce score except when spelling is part of the rubric.',
    'Speech-to-text permitted for multi-paragraph writing tasks.',
  ].join('\n')

  assert.equal(selectAccommodationDraft([structured, focused]), focused)
})

test('selectAccommodationDraft prefers a focused recovery draft over a heading-only photo draft', () => {
  const headingOnly = [
    'MODIFICATIONS needed:',
    'ACCOMMODATIONS',
    'SETTING / SCHEDULING',
    'TEACHER DIRECTIONS',
    'STUDENT RESPONSE',
    'ORGANIZATION / STUDY SKILLS',
  ].join('\n')
  const focusedRecovery = [
    'Student Response',
    'Use of speech-to-text application.',
    'No penalty for spelling [unclear] except on spelling tasks.',
    'Use of a calculator [unclear] except for calculation tests.',
  ].join('\n')

  assert.equal(selectAccommodationDraft([headingOnly, focusedRecovery]), focusedRecovery)
})

test('formatAccommodationReviewText turns raw accommodation extraction into editable sections', () => {
  const rawText = [
    'Accommodations need for student to be invo[lved]',
    'Note: Accommodations do NOT fundamentally alter or lower',
    'SETTING / SCHEDULING',
    'Test in small group when requested',
    'Extended time to complete assignments (2 days)',
    'Extended time on tests (2 days)',
    'Seat away from distractions/noise',
    'TEACHER DIRECTIONS',
    'Directions given in a variety of ways',
    'Frequent checks for understanding',
    'SPEECH & ASSESSMENT',
    'STUDENT RESPONSE',
    'Speech-to-text application',
    'No penalty for spelling except on spelling task',
  ].join('\n')

  assert.equal(
    formatAccommodationReviewText(rawText),
    [
      'Accommodations need for student to be invo[lved]',
      'Note: Accommodations do NOT fundamentally alter or lower',
      '',
      'Setting / Scheduling:',
      '- Test in small group when requested',
      '- Extended time to complete assignments (2 days)',
      '- Extended time on tests (2 days)',
      '- Seat away from distractions/noise',
      '',
      'Teacher Directions:',
      '- Directions given in a variety of ways',
      '- Frequent checks for understanding',
      '',
      'Speech & Assessment',
      '',
      'Student Response:',
      '- Speech-to-text application',
      '- No penalty for spelling except on spelling task',
    ].join('\n'),
  )
})

test('formatAccommodationReviewText keeps form metadata readable without turning it into accommodations', () => {
  const rawText = [
    'STUDENT INFORMATION',
    'Student Name: Juliette',
    'Meeting Date: 11/19/2025',
    'WRITING ACCOMMODATIONS',
    'Spelling errors will not reduce score except when spelling is part of the rubric.',
    '- Speech-to-text permitted for multi-paragraph writing tasks.',
  ].join('\n')

  assert.equal(
    formatAccommodationReviewText(rawText),
    [
      'Student Information',
      'Student Name: Juliette',
      'Meeting Date: 11/19/2025',
      '',
      'Writing Accommodations:',
      '- Spelling errors will not reduce score except when spelling is part of the rubric.',
      '- Speech-to-text permitted for multi-paragraph writing tasks.',
    ].join('\n'),
  )
})
