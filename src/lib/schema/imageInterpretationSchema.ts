import { z } from 'zod'

export const imageDocumentTypeSchema = z.enum([
  'iep_accommodation_page',
  'assignment_rubric',
  'assignment_page',
  'other_school_document',
  'unknown',
])

export const accommodationCategorySchema = z.enum([
  'timing',
  'setting',
  'reading',
  'writing',
  'math',
  'instruction',
  'attention',
  'organization',
  'assistive_technology',
  'other',
])

export const normalizedAccommodationTypeSchema = z.enum([
  'extended_time',
  'reduced_distraction_setting',
  'read_aloud',
  'speech_to_text',
  'calculator_use',
  'spelling_mechanics_flexibility',
  'preferential_seating',
  'breaks',
  'chunked_instructions',
  'assignment_modification',
  'other',
])

export const accommodationExtractionSchema = z.object({
  category: accommodationCategorySchema,
  conditions: z.array(z.string().trim()).default([]),
  label: z.string().trim().min(1),
  normalized_type: normalizedAccommodationTypeSchema,
  source_evidence: z.string().trim().min(1),
}).strict()

export const accommodationUploadInterpretationSchema = z.object({
  accommodations: z.array(accommodationExtractionSchema),
  confidence: z.number().min(0).max(1),
  document_type: imageDocumentTypeSchema,
  student_name_present: z.boolean(),
  unclear_sections: z.array(z.string().trim()).default([]),
}).strict()

export const assignmentTypeSchema = z.enum([
  'essay',
  'worksheet',
  'quiz',
  'test',
  'reading_response',
  'project',
  'presentation',
  'math_assignment',
  'science_lab',
  'unknown',
])

export const assignmentRequirementTypeSchema = z.enum([
  'written_output',
  'oral_output',
  'reading_load',
  'spelling_mechanics',
  'time_constraint',
  'memory_recall',
  'math_computation',
  'multi_step_instructions',
  'research',
  'group_work',
  'formatting_requirement',
  'deadline',
])

export const assignmentRequirementSchema = z.object({
  text: z.string().trim().min(1),
  type: assignmentRequirementTypeSchema,
}).strict()

export const assignmentUploadInterpretationSchema = z.object({
  access_relevant_details: z.array(z.string().trim().min(1)).default([]),
  assignment_type: assignmentTypeSchema,
  confidence: z.number().min(0).max(1),
  detected_requirements: z.array(assignmentRequirementSchema),
  document_type: imageDocumentTypeSchema,
  follow_up_questions: z.array(z.string().trim().min(1)).default([]),
  grading_factors: z.array(z.string().trim().min(1)),
  must_ask_for_more_context: z.boolean(),
  task_summary: z.string().trim().min(1),
}).strict()

export type AccommodationCategory = z.infer<typeof accommodationCategorySchema>
export type AccommodationExtraction = z.infer<typeof accommodationExtractionSchema>
export type AccommodationUploadInterpretation = z.infer<
  typeof accommodationUploadInterpretationSchema
>
export type AssignmentRequirement = z.infer<typeof assignmentRequirementSchema>
export type AssignmentRequirementType = z.infer<typeof assignmentRequirementTypeSchema>
export type AssignmentType = z.infer<typeof assignmentTypeSchema>
export type AssignmentUploadInterpretation = z.infer<
  typeof assignmentUploadInterpretationSchema
>
export type ImageDocumentType = z.infer<typeof imageDocumentTypeSchema>
export type NormalizedAccommodationType = z.infer<
  typeof normalizedAccommodationTypeSchema
>

export function parseAccommodationUploadInterpretation(input: unknown) {
  return accommodationUploadInterpretationSchema.parse(input)
}

export function parseAssignmentUploadInterpretation(input: unknown) {
  return assignmentUploadInterpretationSchema.parse(input)
}
