import type {
  IepReviewDraft,
  TaskReviewDraft,
  UnknownReviewDraft,
} from '../../lib/schema/ocrSchema'
import type { SourceMaterial, UploadedAttachment } from '../../types/analysis'

function uniqueTextBlocks(blocks: string[]) {
  return Array.from(new Set(blocks.map((block) => block.trim()).filter(Boolean)))
}

function normalizeSourceReviewLine(line: string) {
  return line
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/:$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function looksLikeReviewHeading(line: string) {
  const trimmedLine = line.trim()

  if (/^[-*•]|\d+[.)]\s/.test(trimmedLine)) {
    return false
  }

  return trimmedLine.endsWith(':') || /^[A-Z][A-Za-z\s/&-]{3,48}$/.test(trimmedLine)
}

export function mergeSourceTextBlock(currentText: string, nextBlock: string) {
  return uniqueTextBlocks([
    ...currentText.split(/\n\s*\n/),
    nextBlock,
  ]).join('\n\n')
}

export function addMissingSourceTextBlock(currentText: string, nextBlock: string) {
  const existingLineKeys = new Set(
    currentText
      .split('\n')
      .map(normalizeSourceReviewLine)
      .filter(Boolean),
  )
  const missingBlocks = nextBlock
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .flatMap((lines) => {
      const missingLines = lines.filter((line) => {
        const lineKey = normalizeSourceReviewLine(line)
        return lineKey && !existingLineKeys.has(lineKey)
      })

      if (missingLines.length === 0) {
        return []
      }

      const firstLine = lines[0]

      if (
        firstLine
        && looksLikeReviewHeading(firstLine)
        && !missingLines.includes(firstLine)
      ) {
        return [[firstLine, ...missingLines].join('\n')]
      }

      return [missingLines.join('\n')]
    })

  return mergeSourceTextBlock(currentText, missingBlocks.join('\n\n'))
}

export function replaceSourceTextBlock(
  currentText: string,
  previousBlock: string | undefined,
  nextBlock: string,
) {
  const trimmedPreviousBlock = previousBlock?.trim()
  const trimmedNextBlock = nextBlock.trim()
  const blocks = currentText.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)

  if (!trimmedPreviousBlock) {
    return mergeSourceTextBlock(currentText, trimmedNextBlock)
  }

  let replaced = false
  const nextBlocks = blocks.flatMap((block) => {
    if (block !== trimmedPreviousBlock) {
      return [block]
    }

    replaced = true
    return trimmedNextBlock ? [trimmedNextBlock] : []
  })

  if (!replaced && trimmedNextBlock) {
    nextBlocks.push(trimmedNextBlock)
  }

  return uniqueTextBlocks(nextBlocks).join('\n\n')
}

function formatLabeledLines(label: string, values: string[]) {
  if (values.length === 0) {
    return ''
  }

  return `${label}:\n${values.map((value) => `- ${value}`).join('\n')}`
}

export function buildIepSourceSummary(draft: IepReviewDraft) {
  const lines = [
    draft.studentName.trim() ? `Student name: ${draft.studentName.trim()}` : '',
    draft.district.trim() ? `District: ${draft.district.trim()}` : '',
    draft.dob.trim() ? `DOB: ${draft.dob.trim()}` : '',
    draft.meetingDate.trim() ? `Meeting date: ${draft.meetingDate.trim()}` : '',
    formatLabeledLines(
      'Learning disability or profile wording',
      draft.learningDisabilityOrProfileText,
    ),
    ...draft.sections.map((section) =>
      formatLabeledLines(section.title.trim(), section.items),
    ),
    formatLabeledLines('Modifications', draft.modifications),
  ]

  return lines.filter(Boolean).join('\n\n')
}

export function buildTaskSourceSummary(draft: TaskReviewDraft) {
  const accessRelevantDetails = draft.accessRelevantDetails ?? []
  const evidenceBullets = draft.evidenceBullets ?? []
  const followUpQuestions = draft.followUpQuestions ?? []
  const visibleDocumentType = draft.visibleDocumentType ?? 'unknown'
  const accommodationFocus = draft.accommodationFocus ?? 'unknown'
  const lines = [
    draft.taskDescription.trim(),
    visibleDocumentType !== 'unknown'
      ? `Visible document: ${visibleDocumentType}`
      : '',
    draft.subject.trim() ? `Subject: ${draft.subject.trim()}` : '',
    accommodationFocus !== 'unknown'
      ? `Accommodation focus: ${accommodationFocus}`
      : '',
    draft.workType !== 'unknown' ? `Work type: ${draft.workType}` : '',
    draft.topic.trim() ? `Topic: ${draft.topic.trim()}` : '',
    draft.timedStatus !== 'unknown' ? `Timing: ${draft.timedStatus}` : '',
    typeof draft.timeLimitMinutes === 'number'
      ? `Time limit: ${draft.timeLimitMinutes} minutes`
      : '',
    `Calculation focus: ${draft.calculationFocus}`,
    formatLabeledLines('Access-relevant visible details', accessRelevantDetails),
    formatLabeledLines('Visible task evidence', evidenceBullets),
    formatLabeledLines('Follow-up answers to confirm', followUpQuestions),
  ]

  return lines.filter(Boolean).join('\n\n')
}

export function buildUnknownSourceSummary(draft: UnknownReviewDraft) {
  return [
    draft.summary.trim(),
    formatLabeledLines('Visible evidence', draft.evidenceBullets),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function normalizeDocumentDraft(
  draft: UploadedAttachment['documentDraft'],
): UploadedAttachment['documentDraft'] {
  if (!draft) {
    return draft
  }

  if ('sections' in draft) {
    return {
      ...draft,
      sourceSummaryText: buildIepSourceSummary(draft),
    }
  }

  if ('taskDescription' in draft) {
    return {
      ...draft,
      sourceSummaryText: buildTaskSourceSummary(draft),
    }
  }

  return {
    ...draft,
    sourceSummaryText: buildUnknownSourceSummary(draft),
  }
}

export function getAttachmentSourceText(attachment: UploadedAttachment) {
  if (
    attachment.status !== 'included'
    && attachment.status !== 'applied_to_text'
    && attachment.status !== 'text_ready'
  ) {
    return ''
  }

  if (attachment.documentDraft?.sourceSummaryText?.trim()) {
    return attachment.documentDraft.sourceSummaryText.trim()
  }

  return attachment.reviewedText?.trim() ?? ''
}

export function getAttachmentPreviousSourceText(attachment: UploadedAttachment) {
  if (attachment.sourceTrailText?.trim()) {
    return attachment.sourceTrailText.trim()
  }

  if (attachment.documentDraft?.sourceSummaryText?.trim()) {
    return attachment.documentDraft.sourceSummaryText.trim()
  }

  return attachment.extractedText?.trim() ?? ''
}

export function getReadableAttachmentSourceText(attachment: UploadedAttachment) {
  const sourceText = getAttachmentSourceText(attachment)

  if (!sourceText) {
    return ''
  }

  return `[Reviewed upload: ${attachment.name}]\n${sourceText}`
}

export function hasIncludedAttachmentSource(attachment: UploadedAttachment) {
  return Boolean(getAttachmentSourceText(attachment))
}

export function getSourceReadyAttachments(attachments: UploadedAttachment[]) {
  return attachments.filter(hasIncludedAttachmentSource)
}

export function getReviewedTextAttachments(attachments: UploadedAttachment[]) {
  return attachments.filter((attachment) => Boolean(attachment.reviewedText?.trim()))
}

export function getPendingReviewAttachments(attachments: UploadedAttachment[]) {
  return attachments.filter((attachment) => {
    if (attachment.status === 'text_ready') {
      return Boolean(attachment.extractedText?.trim() && !attachment.reviewedText?.trim())
    }

    if (attachment.status !== 'review_ready') {
      return false
    }

    return Boolean(
      attachment.documentDraft
      || attachment.extractedText?.trim()
      || attachment.reviewedText?.trim(),
    )
  })
}

export function getReferenceOnlyAttachments(attachments: UploadedAttachment[]) {
  return attachments.filter((attachment) => !hasIncludedAttachmentSource(attachment))
}

export function getCombinedReviewedAttachmentText(
  attachments: UploadedAttachment[],
) {
  return uniqueTextBlocks(
    getSourceReadyAttachments(attachments).map((attachment) =>
      getReadableAttachmentSourceText(attachment),
    ),
  ).join('\n\n')
}

export function buildEffectiveSourceText(source: SourceMaterial) {
  const textBlocks = uniqueTextBlocks([
    source.text,
    ...getSourceReadyAttachments(source.attachments).map((attachment) =>
      getAttachmentSourceText(attachment),
    ),
  ])

  return textBlocks.join('\n\n')
}

export function hasUsableSourceText(source: SourceMaterial) {
  return buildEffectiveSourceText(source).trim().length > 0
}

export function getPrimaryTaskTraits(source: SourceMaterial): TaskReviewDraft | null {
  const attachment = source.attachments.find(
    (candidate) =>
      (candidate.status === 'included' || candidate.status === 'applied_to_text')
      && candidate.documentKind === 'assignment_or_quiz'
      && candidate.documentDraft
      && 'taskDescription' in candidate.documentDraft,
  )

  if (!attachment?.documentDraft || !('taskDescription' in attachment.documentDraft)) {
    return null
  }

  return attachment.documentDraft
}
