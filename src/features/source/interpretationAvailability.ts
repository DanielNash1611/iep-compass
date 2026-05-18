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

  if (
    attachment.isDemoSeed &&
    !documentPlan.browserImageInterpretation.supported &&
    !documentPlan.endpointFallback.configured
  ) {
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
      ? 'Read this image in the browser'
      : documentPlan.endpointFallback.runtimeLabel === 'Local Ollama'
        ? 'Read this image'
        : 'Read with the saved reader'

  let note: string | null = null

  if (attachment.isDemoSeed && isInterpretable && isRetryState) {
    note = documentPlan.endpointFallback.configured
      ? `Read this sample image with the ${documentPlan.endpointFallback.runtimeLabel} image reader to create a draft you can check. The original image stays as a reference until you approve the wording.`
      : 'No local image reader is configured. Paste the visible wording manually, enter an Ollama endpoint in this browser, or run locally with VITE_GEMMA_BASE_URL=/api/ollama in .env.local.'
  } else if (needsModel) {
    note = documentPlan.browserImageInterpretation.supported
      ? 'Browser image interpretation is not ready in this session. Check the browser model gate before trying again.'
      : 'Browser Gemma 4 E2B handles reviewed-text mapping here. Use a configured local Gemma image reader, enter an Ollama endpoint, or paste the visible wording manually.'
  }

  return {
    canInterpret,
    label,
    needsModel,
    note,
  }
}
