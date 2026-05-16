import type {
  AttachmentKind,
  AttachmentStatus,
  UploadedAttachment,
} from '../../types/analysis'

function inferAttachmentKind(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) {
    return 'image'
  }

  if (file.type === 'application/pdf') {
    return 'pdf'
  }

  if (
    file.type.startsWith('text/') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.md')
  ) {
    return 'text'
  }

  return 'other'
}

function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildPdfProgressNote(attachment: UploadedAttachment) {
  if (attachment.kind !== 'pdf' || !attachment.processedPageCount) {
    return null
  }

  if (
    typeof attachment.pageCount === 'number' &&
    attachment.pageCount > attachment.processedPageCount
  ) {
    return `This phase read the first ${attachment.processedPageCount} of ${attachment.pageCount} pages.`
  }

  return `Read ${attachment.processedPageCount} ${
    attachment.processedPageCount === 1 ? 'page' : 'pages'
  } in this phase.`
}

export function formatElapsedTime(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function buildInterpretationTimingNote(attachment: UploadedAttachment) {
  const elapsedMs =
    attachment.interpretationProgress?.elapsedMs
    ?? (
      attachment.interpretationProgress?.finishedAt
      && attachment.interpretationProgress.startedAt
        ? attachment.interpretationProgress.finishedAt
          - attachment.interpretationProgress.startedAt
        : undefined
    )

  if (typeof elapsedMs !== 'number') {
    return null
  }

  return `Gemma interpretation took ${formatElapsedTime(elapsedMs)}.`
}

function buildStatusNotes(
  attachment: UploadedAttachment,
  status: AttachmentStatus,
) {
  switch (status) {
    case 'text_ready':
      return [
        'Text file read locally and ready for the source trail.',
      ]
    case 'interpret_ready':
      return attachment.kind === 'pdf'
        ? [
            'Ready for document reading when a supported browser path or configured development endpoint is available.',
            'This phase interprets up to the first 3 PDF pages.',
          ]
        : [
            'Ready for document reading when a supported browser path or configured development endpoint is available.',
            'Use this only when the visible document details can be reviewed here.',
          ]
    case 'interpret_running':
      return [
        attachment.interpretationProgress?.label
          ? `${attachment.interpretationProgress.label}.`
          : `Interpreting the visible document with Gemma 4${
              attachment.kind === 'pdf' ? ' from the first PDF pages' : ''
            }.`,
        attachment.interpretationProgress?.detail,
      ]
        .filter(Boolean) as string[]
    case 'review_ready':
      return [
        attachment.documentDraft
          ? 'Structured document draft is ready. Review it before using it in the source trail.'
          : 'Extracted text is ready. Review it before using it in the source trail.',
        buildInterpretationTimingNote(attachment),
        buildPdfProgressNote(attachment),
        ...(attachment.readContainsUnclearText
          ? ['Some wording was unclear, blank, or redacted and was preserved honestly in the extracted text.']
          : []),
        ...(attachment.readNotes ?? []),
      ].filter(Boolean) as string[]
    case 'included':
      return [
        'Reviewed upload details are included in this source trail.',
        buildInterpretationTimingNote(attachment),
        buildPdfProgressNote(attachment),
        ...(attachment.readContainsUnclearText
          ? ['A few unclear, blank, or redacted spots were preserved so the source stays honest.']
          : []),
        ...(attachment.readNotes ?? []),
      ].filter(Boolean) as string[]
    case 'reference_only':
      return [
        'This file stays as a reference only and is not part of the source trail.',
        buildPdfProgressNote(attachment),
      ].filter(Boolean) as string[]
    case 'failed':
      return [
        attachment.readError ||
          (attachment.kind === 'text'
            ? 'We could not read this text file locally.'
            : 'We could not interpret enough of this file clearly in this phase.'),
        buildInterpretationTimingNote(attachment),
        attachment.kind === 'pdf'
          ? 'You can keep it as a reference, paste the needed wording, or upload a shorter excerpt.'
          : 'You can keep it as a reference and type the important wording below.',
      ].filter(Boolean) as string[]
    default:
      return ['This file stays as a reference in this phase.']
  }
}

export function refreshAttachmentNotes(
  attachment: UploadedAttachment,
): UploadedAttachment {
  return {
    ...attachment,
    notes: buildStatusNotes(attachment, attachment.status),
  }
}

export function createUploadedAttachment(file: File): UploadedAttachment {
  const kind = inferAttachmentKind(file)
  let previewUrl: string | undefined

  if (kind === 'image') {
    previewUrl = URL.createObjectURL(file)
  }

  const attachment: UploadedAttachment = {
    file,
    fileType: file.type,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${file.name}-${file.lastModified}`,
    kind,
    name: file.name,
    notes: [],
    previewUrl,
    sizeLabel: formatFileSize(file.size),
    status:
      kind === 'text'
        ? 'interpret_running'
        : kind === 'image' || kind === 'pdf'
          ? 'interpret_ready'
          : 'reference_only',
  }

  return refreshAttachmentNotes(attachment)
}

export async function loadLocalTextAttachment(
  attachment: UploadedAttachment,
): Promise<UploadedAttachment> {
  if (attachment.kind !== 'text') {
    return attachment
  }

  try {
    const extractedText = await attachment.file.text()
    const trimmedText = extractedText.trim()

    if (!trimmedText) {
      return refreshAttachmentNotes({
        ...attachment,
        extractedText: '',
        readError: 'This text file did not contain readable text.',
        readMethod: 'plain_text_file',
        reviewedText: undefined,
        status: 'failed',
      })
    }

    return refreshAttachmentNotes({
      ...attachment,
      extractedText,
      readError: undefined,
      readMethod: 'plain_text_file',
      reviewedText: extractedText,
      status: 'included',
    })
  } catch (error) {
    return refreshAttachmentNotes({
      ...attachment,
      readError:
        error instanceof Error
          ? error.message
          : 'We could not read this text file locally.',
      reviewedText: undefined,
      status: 'failed',
    })
  }
}

export function revokeAttachmentPreview(
  attachment: Pick<UploadedAttachment, 'previewUrl' | 'previewUrlIsStatic'>,
) {
  if (attachment.previewUrl && !attachment.previewUrlIsStatic) {
    URL.revokeObjectURL(attachment.previewUrl)
  }
}
