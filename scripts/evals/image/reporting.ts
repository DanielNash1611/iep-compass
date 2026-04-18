import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  ImageEvalCaseResult,
  ImageEvalRunReport,
  ImageEvalRunSummary,
  ImageEvalSuiteId,
  ImageEvalSuiteReport,
} from './types.ts'

function average(values: Array<number | null | undefined>) {
  const filteredValues = values.filter((value): value is number => typeof value === 'number')

  if (filteredValues.length === 0) {
    return null
  }

  return filteredValues.reduce((sum, value) => sum + value, 0) / filteredValues.length
}

function roundMetric(value: number | null) {
  if (value === null) {
    return null
  }

  return Number(value.toFixed(3))
}

export function summarizeImageEvalCases(
  suite: ImageEvalSuiteId,
  cases: ImageEvalCaseResult[],
): ImageEvalSuiteReport {
  const executedCases = cases.filter((item) => item.status !== 'skipped')
  const passedCases = executedCases.filter((item) => item.status === 'passed')
  const failedCases = executedCases.filter((item) => item.status === 'failed')
  const failureTagCounts = executedCases.reduce<Record<string, number>>((accumulator, item) => {
    item.failure_tags.forEach((tag) => {
      accumulator[tag] = (accumulator[tag] || 0) + 1
    })
    return accumulator
  }, {})

  const judgeDimensionSums = executedCases.reduce<{
    counts: Record<string, number>
    sums: Record<string, number>
  }>(
    (accumulator, item) => {
      if (!item.judge) {
        return accumulator
      }

      Object.entries(item.judge.dimensions).forEach(([dimension, value]) => {
        accumulator.sums[dimension] = (accumulator.sums[dimension] || 0) + value
        accumulator.counts[dimension] = (accumulator.counts[dimension] || 0) + 1
      })

      return accumulator
    },
    { counts: {}, sums: {} },
  )

  const averageJudgeDimensions = Object.fromEntries(
    Object.entries(judgeDimensionSums.sums).map(([dimension, sum]) => [
      dimension,
      Number((sum / judgeDimensionSums.counts[dimension]).toFixed(3)),
    ]),
  )

  const summary: ImageEvalRunSummary = {
    average_field_score: roundMetric(average(executedCases.map((item) => item.field.score))) || 0,
    average_judge_dimensions: averageJudgeDimensions,
    average_judge_overall:
      roundMetric(
        average(
          executedCases.map((item) => average(Object.values(item.judge?.dimensions || {}))),
        ),
      ),
    average_uncertainty_handling_score:
      roundMetric(
        average(executedCases.map((item) => item.metrics.uncertainty_handling_score)),
      ) || 0,
    case_ids_failed: failedCases.map((item) => item.case.id),
    condition_preservation_score: roundMetric(
      average(executedCases.map((item) => item.metrics.condition_preservation_score)),
    ),
    executed_cases: executedCases.length,
    failed_cases: failedCases.length,
    failure_tag_counts: failureTagCounts,
    hallucination_rate:
      roundMetric(average(executedCases.map((item) => item.metrics.hallucination_flagged))) || 0,
    incomplete_image_handling_score: roundMetric(
      average(executedCases.map((item) => item.metrics.incomplete_image_handling_score)),
    ),
    pass_rate:
      executedCases.length > 0
        ? Number((passedCases.length / executedCases.length).toFixed(3))
        : 0,
    passed_cases: passedCases.length,
    skipped_cases: cases.filter((item) => item.status === 'skipped').length,
    total_cases: cases.length,
  }

  return {
    cases,
    suite,
    summary,
  }
}

function formatFailureTagCounts(failureTagCounts: Record<string, number>) {
  const sorted = Object.entries(failureTagCounts).sort((left, right) => right[1] - left[1])

  if (sorted.length === 0) {
    return 'none'
  }

  return sorted.map(([tag, count]) => `${tag} (${count})`).join(', ')
}

export function renderSuiteSummary(report: ImageEvalSuiteReport) {
  const { summary } = report

  return [
    `Suite: ${report.suite}`,
    `  Total cases: ${summary.total_cases}`,
    `  Executed cases: ${summary.executed_cases}`,
    `  Skipped cases: ${summary.skipped_cases}`,
    `  Pass rate: ${summary.pass_rate}`,
    `  Hallucination rate: ${summary.hallucination_rate}`,
    `  Uncertainty-handling score: ${summary.average_uncertainty_handling_score}`,
    `  Condition-preservation score: ${summary.condition_preservation_score ?? 'n/a'}`,
    `  Incomplete-image handling score: ${summary.incomplete_image_handling_score ?? 'n/a'}`,
    `  Major failure categories: ${formatFailureTagCounts(summary.failure_tag_counts)}`,
    `  Failed case ids: ${summary.case_ids_failed.join(', ') || 'none'}`,
  ].join('\n')
}

export function renderMarkdownReport(report: ImageEvalRunReport) {
  const sections = report.suites.map((suiteReport) => {
    const dimensionLines =
      Object.keys(suiteReport.summary.average_judge_dimensions).length > 0
        ? Object.entries(suiteReport.summary.average_judge_dimensions)
            .map(([dimension, value]) => `- ${dimension}: ${value}`)
            .join('\n')
        : '- judge disabled or unavailable'

    const failedCases = suiteReport.cases
      .filter((item) => item.status === 'failed')
      .map(
        (item) =>
          `- ${item.case.id}: ${item.failure_tags.join(', ') || 'uncategorized'}${
            item.parse_error ? ` | parse: ${item.parse_error}` : ''
          }`,
      )
      .join('\n') || '- none'

    return [
      `## ${suiteReport.suite}`,
      '',
      `- Total cases: ${suiteReport.summary.total_cases}`,
      `- Executed cases: ${suiteReport.summary.executed_cases}`,
      `- Pass rate: ${suiteReport.summary.pass_rate}`,
      `- Hallucination rate: ${suiteReport.summary.hallucination_rate}`,
      `- Uncertainty-handling score: ${suiteReport.summary.average_uncertainty_handling_score}`,
      `- Condition-preservation score: ${suiteReport.summary.condition_preservation_score ?? 'n/a'}`,
      `- Incomplete-image handling score: ${suiteReport.summary.incomplete_image_handling_score ?? 'n/a'}`,
      `- Major failure categories: ${formatFailureTagCounts(suiteReport.summary.failure_tag_counts)}`,
      '',
      '### Judge dimensions',
      dimensionLines,
      '',
      '### Failed cases',
      failedCases,
    ].join('\n')
  })

  return [
    '# Gemma image eval report',
    '',
    `- Generated at: ${report.generated_at}`,
    `- Model: ${report.model}`,
    `- Judge mode: ${report.judge_mode}`,
    `- Judge model: ${report.judge_model || 'n/a'}`,
    '',
    ...sections,
  ].join('\n')
}

export async function writeReportFile(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, content, 'utf8')
}
