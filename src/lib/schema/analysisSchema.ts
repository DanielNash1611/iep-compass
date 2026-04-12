import { z } from 'zod'

export const confidenceSchema = z.enum([
  'likely_relevant',
  'possibly_relevant',
  'unclear_confirm',
])

export const relevantAccommodationSchema = z.object({
  confidence: confidenceSchema,
  implementationNotes: z.array(z.string()),
  name: z.string(),
  plainLanguage: z.string(),
  sourceText: z.string(),
  whyItMayMatter: z.string(),
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
  teacherReminders: z.array(z.string()),
})

export type AccommodationConfidence = z.infer<typeof confidenceSchema>
export type AnalysisResult = z.infer<typeof analysisResultSchema>

export function parseAnalysisResult(input: unknown) {
  return analysisResultSchema.parse(input)
}
