import type { SourceMaterial, UploadedAttachment } from '../../types/analysis'

function uniqueTextBlocks(blocks: string[]) {
  return Array.from(new Set(blocks.map((block) => block.trim()).filter(Boolean)))
}

export function getExtractedTextAttachments(attachments: UploadedAttachment[]) {
  return attachments.filter((attachment) => attachment.extractedText?.trim())
}

export function getCombinedAttachmentText(attachments: UploadedAttachment[]) {
  return uniqueTextBlocks(
    getExtractedTextAttachments(attachments).map(
      (attachment) =>
        `[Uploaded text: ${attachment.name}]\n${attachment.extractedText?.trim() ?? ''}`,
    ),
  ).join('\n\n')
}

export function buildEffectiveSourceText(source: SourceMaterial) {
  const textBlocks = uniqueTextBlocks([
    source.text,
    getCombinedAttachmentText(source.attachments),
  ])

  return textBlocks.join('\n\n')
}

export function hasUsableSourceText(source: SourceMaterial) {
  return buildEffectiveSourceText(source).trim().length > 0
}
