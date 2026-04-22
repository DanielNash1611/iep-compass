import { z } from 'zod'

import {
  accommodationCategorySchema,
  assignmentRequirementTypeSchema,
  assignmentTypeSchema,
  imageDocumentTypeSchema,
  normalizedAccommodationTypeSchema,
} from '../../../src/lib/schema/imageInterpretationSchema.ts'

const baseCaseSchema = z.object({
  id: z.string().trim().min(1),
  image_path: z.string().trim().min(1),
  label: z.string().trim().min(1),
  notes: z.array(z.string().trim()).default([]),
}).strict()

const expectedAccommodationSchema = z.object({
  category: accommodationCategorySchema.optional(),
  conditions: z.array(z.string().trim()).default([]),
  label_keywords: z.array(z.string().trim()).default([]),
  normalized_type: normalizedAccommodationTypeSchema.optional(),
  source_evidence_keywords: z.array(z.string().trim()).default([]),
}).strict()

const expectedRequirementSchema = z.object({
  text_keywords: z.array(z.string().trim()).default([]),
  type: assignmentRequirementTypeSchema,
}).strict()

const expectedFollowUpQuestionSchema = z.object({
  text_keywords: z.array(z.string().trim()).default([]),
}).strict()

export const accommodationUploadEvalCaseSchema = baseCaseSchema.extend({
  expected: z.object({
    conditions: z.array(z.string().trim()).default([]),
    document_type: imageDocumentTypeSchema.optional(),
    expected_accommodations: z.array(expectedAccommodationSchema).default([]),
    must_include_keywords: z.array(z.string().trim()).default([]),
    must_not_include: z.array(z.string().trim()).default([]),
    requires_uncertainty: z.boolean().default(false),
  }).strict(),
  suite: z.literal('accommodation_upload'),
}).strict()

export const assignmentUploadEvalCaseSchema = baseCaseSchema.extend({
  expected: z.object({
    assignment_type: assignmentTypeSchema,
    document_type: imageDocumentTypeSchema,
    must_detect_grading_factors: z.array(z.string().trim()).default([]),
    must_detect_requirements: z.array(expectedRequirementSchema).default([]),
    must_ask_follow_up_questions: z.array(expectedFollowUpQuestionSchema).default([]),
    must_include_keywords: z.array(z.string().trim()).default([]),
    must_not_include: z.array(z.string().trim()).default([]),
    requires_uncertainty: z.boolean().default(false),
  }).strict(),
  suite: z.literal('assignment_upload'),
}).strict()

export const imageEvalCaseSchema = z.discriminatedUnion('suite', [
  accommodationUploadEvalCaseSchema,
  assignmentUploadEvalCaseSchema,
])

export type AccommodationUploadEvalCase = z.infer<
  typeof accommodationUploadEvalCaseSchema
>
export type AssignmentUploadEvalCase = z.infer<typeof assignmentUploadEvalCaseSchema>
export type ImageEvalCase = z.infer<typeof imageEvalCaseSchema>
