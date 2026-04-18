import { z } from 'zod'

export const confidenceSchema = z.enum([
  'likely_relevant',
  'possibly_relevant',
  'unclear_confirm',
])

export const relevantAccommodationSchema = z.object({
  applicationReason: z.string(),
  confidence: confidenceSchema,
  implementationNotes: z.array(z.string()),
  name: z.string(),
  plainLanguage: z.string(),
  sourceText: z.string(),
  whyItMayMatter: z.string(),
})

export const teacherConcernEvaluationSchema = z.object({
  concern: z.string(),
  guidance: z.string(),
  suggestedResponse: z.string(),
  verdict: z.enum([
    'supports_teacher_concern',
    'supports_accommodation',
    'mixed_needs_context',
  ]),
})

export const skippedAccommodationSchema = z.object({
  name: z.string(),
  reason: z.string(),
})

export const coreAnalysisResultSchema = z.object({
  boundaries: z.array(z.string()),
  notObviouslyRelevant: z.array(skippedAccommodationSchema),
  relevantAccommodations: z.array(relevantAccommodationSchema),
})

export const studentGuidanceSchema = z.object({
  alternativeScripts: z.array(z.string()),
  startHere: z.string(),
  suggestedScript: z.string(),
})

export const parentGuidanceSchema = z.object({
  coachNotes: z.array(z.string()),
  summary: z.string(),
})

export const teacherGuidanceSchema = z.object({
  staffNotes: z.array(z.string()),
  summary: z.string(),
})

export const analysisResultSchema = coreAnalysisResultSchema.extend({
  parentGuidance: parentGuidanceSchema,
  studentGuidance: studentGuidanceSchema,
  teacherGuidance: teacherGuidanceSchema,
})

export type AccommodationConfidence = z.infer<typeof confidenceSchema>
export type CoreAnalysisResult = z.infer<typeof coreAnalysisResultSchema>
export type AnalysisResult = z.infer<typeof analysisResultSchema>
export type ParentGuidance = z.infer<typeof parentGuidanceSchema>
export type StudentGuidance = z.infer<typeof studentGuidanceSchema>
export type TeacherGuidance = z.infer<typeof teacherGuidanceSchema>
export type TeacherConcernEvaluation = z.infer<
  typeof teacherConcernEvaluationSchema
>

export function parseCoreAnalysisResult(input: unknown) {
  return coreAnalysisResultSchema.parse(input)
}

export function parseAnalysisResult(input: unknown) {
  return analysisResultSchema.parse(input)
}

export function parseTeacherConcernEvaluation(input: unknown) {
  return teacherConcernEvaluationSchema.parse(input)
}
