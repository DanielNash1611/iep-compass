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

export const analysisResultSchema = z.object({
  boundaries: z.array(z.string()),
  notObviouslyRelevant: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
    }),
  ),
  relevantAccommodations: z.array(relevantAccommodationSchema),
  studentAdvocacy: z.object({
    alternativeScripts: z.array(z.string()),
    suggestedScript: z.string(),
  }),
  summary: z.string(),
  teacherConcernEvaluation: teacherConcernEvaluationSchema.nullable(),
  teacherReminders: z.array(z.string()),
})

export type AccommodationConfidence = z.infer<typeof confidenceSchema>
export type AnalysisResult = z.infer<typeof analysisResultSchema>
export type TeacherConcernEvaluation = z.infer<
  typeof teacherConcernEvaluationSchema
>

export function parseAnalysisResult(input: unknown) {
  return analysisResultSchema.parse(input)
}

export function parseTeacherConcernEvaluation(input: unknown) {
  return teacherConcernEvaluationSchema.parse(input)
}
