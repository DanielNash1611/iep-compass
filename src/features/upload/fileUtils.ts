import type { AttachmentKind, UploadedAttachment } from '../../types/analysis'

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

export async function toUploadedAttachment(
  file: File,
): Promise<UploadedAttachment> {
  const kind = inferAttachmentKind(file)

  let extractedText: string | undefined
  let previewUrl: string | undefined

  if (kind === 'text') {
    extractedText = await file.text()
  }

  if (kind === 'image') {
    previewUrl = URL.createObjectURL(file)
  }

  const notes =
    kind === 'text'
      ? [
          'Text files are ready for review and can be pasted into the task box if needed.',
        ]
      : kind === 'image'
        ? [
            'Image preview is ready.',
            'The MVP keeps image analysis explicit, so paste or review the key task text before running the result.',
          ]
        : kind === 'pdf'
          ? [
              'PDF uploaded successfully.',
              'This MVP does not extract PDF text automatically, so review the document and paste the needed details.',
            ]
          : [
              'This file type is stored only as a reference preview in the MVP.',
            ]

  return {
    extractedText,
    file,
    fileType: file.type,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${file.name}-${file.lastModified}`,
    kind,
    name: file.name,
    notes,
    previewUrl,
    sizeLabel: formatFileSize(file.size),
    status:
      kind === 'text' ? 'ready' : kind === 'other' ? 'manual_review_needed' : 'preview_only',
  }
}

export function revokeAttachmentPreview(
  attachment: Pick<UploadedAttachment, 'previewUrl'>,
) {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl)
  }
}
