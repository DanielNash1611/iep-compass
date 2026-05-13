import type { UploadedAttachment } from '../../types/analysis'
import type { GemmaDocumentPlan } from '../upload/documentReadingSupport'

function isInterpretableAttachment(attachment: UploadedAttachment) {
  return attachment.kind === 'image' || attachment.kind === 'pdf'
}

function isInterpretationRetryState(attachment: UploadedAttachment) {
  return (
    attachment.status === 'interpret_ready'
    || attachment.status === 'review_ready'
    || attachment.status === 'failed'
  )
}

export function canRunAttachmentInterpretation(
  attachment: UploadedAttachment,
  documentPlan: GemmaDocumentPlan,
) {
  if (!isInterpretableAttachment(attachment) || !isInterpretationRetryState(attachment)) {
    return false
  }

  if (attachment.isDemoSeed && !documentPlan.browserImageInterpretation.supported) {
    return false
  }

  return documentPlan.configured
}

export function getAttachmentInterpretationAction(
  attachment: UploadedAttachment,
  documentPlan: GemmaDocumentPlan,
) {
  const canInterpret = canRunAttachmentInterpretation(attachment, documentPlan)
  const isInterpretable = isInterpretableAttachment(attachment)
  const isRetryState = isInterpretationRetryState(attachment)
  const needsModel =
    !canInterpret &&
    !attachment.isDemoSeed &&
    isInterpretable &&
    isRetryState

  const label =
    documentPlan.imageInterpretationMode === 'browser'
      ? 'Interpret privately in browser'
      : 'Interpret with configured endpoint'

  let note: string | null = null

  if (attachment.isDemoSeed && isInterpretable && isRetryState) {
    note =
      'This sample image already has a pre-reviewed draft, so the demo can continue without live image interpretation.'
  } else if (needsModel) {
    note = documentPlan.browserImageInterpretation.supported
      ? 'Browser image interpretation is not ready in this session. Check the browser model gate before trying again.'
      : 'Browser Gemma can reason over reviewed text, but this web path does not read images directly. Use pasted text, the pre-reviewed demo draft, or a configured development endpoint.'
  }

  return {
    canInterpret,
    label,
    needsModel,
    note,
  }
}
