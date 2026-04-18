import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import {
  accommodationUploadEvalCaseSchema,
  assignmentUploadEvalCaseSchema,
} from './caseSchemas.ts'
import type {
  LoadedAccommodationUploadEvalCase,
  LoadedAssignmentUploadEvalCase,
  LoadedImageEvalCase,
  ImageEvalSuiteId,
} from './types.ts'

const IMAGE_EVAL_ROOT = path.resolve('scripts/evals/image')

async function readJsonCaseFile(filePath: string) {
  const rawText = await readFile(filePath, 'utf8')
  return JSON.parse(rawText) as unknown
}

async function readSuiteCaseDirectory(suite: ImageEvalSuiteId) {
  const directoryPath = path.join(IMAGE_EVAL_ROOT, 'cases', suite)
  const fileNames = (await readdir(directoryPath)).filter((fileName) =>
    fileName.endsWith('.json'),
  )

  return Promise.all(
    fileNames.map(async (fileName) => {
      const caseFilePath = path.join(directoryPath, fileName)
      const rawCase = await readJsonCaseFile(caseFilePath)

      if (suite === 'accommodation_upload') {
        const parsed = accommodationUploadEvalCaseSchema.parse(rawCase)

        return {
          ...parsed,
          caseFilePath,
          resolvedImagePath: path.resolve(parsed.image_path),
        } satisfies LoadedAccommodationUploadEvalCase
      }

      const parsed = assignmentUploadEvalCaseSchema.parse(rawCase)

      return {
        ...parsed,
        caseFilePath,
        resolvedImagePath: path.resolve(parsed.image_path),
      } satisfies LoadedAssignmentUploadEvalCase
    }),
  )
}

export async function loadImageEvalCases(
  suite?: ImageEvalSuiteId,
): Promise<LoadedImageEvalCase[]> {
  const suites = suite
    ? [suite]
    : (['accommodation_upload', 'assignment_upload'] as const)

  const cases = (await Promise.all(suites.map((item) => readSuiteCaseDirectory(item)))).flat()

  const duplicateIds = cases.reduce<Map<string, number>>((accumulator, evalCase) => {
    accumulator.set(evalCase.id, (accumulator.get(evalCase.id) || 0) + 1)
    return accumulator
  }, new Map())

  const repeatedIds = Array.from(duplicateIds.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id)

  if (repeatedIds.length > 0) {
    throw new Error(`Duplicate image eval case ids: ${repeatedIds.join(', ')}`)
  }

  return cases.sort((left, right) => left.id.localeCompare(right.id))
}
