import {
  parseDocumentReadingResult,
  type DocumentReadingResult,
} from '../../lib/schema/ocrSchema'
import {
  buildTaskDocumentResultFromPlainText,
} from '../../lib/schema/taskDocumentFromText'
import {
  describeObjectKeys,
  parseJsonFromModelOutput,
} from '../../lib/model/structuredOutput'
import { recoverBlankTaskDocumentResult } from '../../lib/schema/documentReadingRecovery'
import { GEMMA_LOCAL_MODEL_ID } from '../../lib/analysis/prompt'
import { selectAccommodationDraft } from '../../lib/text/accommodationDraftSelection'
import {
  ACCOMMODATION_EXTRACTION_SYSTEM_PROMPT,
  buildAccommodationExtractionPrompt,
  buildAccommodationFocusedExtractionPrompt,
  getAccommodationFocusedExtractionPromptOptionsForTile,
} from '../../lib/text/accommodationExtractionPrompt'
import {
  ACCOMMODATION_PHOTO_BROWSER_QUALITY,
  ACCOMMODATION_PHOTO_RECOVERY_CROP_RATIO,
  assessAccommodationDraftHealth,
  getAccommodationImagePrepDecision,
  getAccommodationPhotoRecoveryTileRects,
  mergeAccommodationPhotoRecoveryTileDrafts,
  shouldTriggerAccommodationFocusedRecovery,
  type AccommodationDraftHealth,
  type AccommodationImagePrepAsset,
  type AccommodationPhotoRecoveryTileLabel,
} from '../../lib/text/accommodationImagePrep'
import type {
  AttachmentInterpretationPhase,
  UploadedAttachment,
} from '../../types/analysis'
import { renderPdfPagesToImageDataUrls } from './pdfPageImages'

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface GemmaDocumentConfig {
  apiKey?: string
  baseUrl?: string
  fallbackModel?: string
  isRemote: boolean
  primaryModel: string
  runtimeLabel: string
}

export interface GemmaDocumentPlan {
  configured: boolean
  isRemote: boolean
  primaryModel: string
  runtimeLabel: string
}

export interface GemmaDocumentReadingResult {
  documentResult: DocumentReadingResult
  modelLabel: string
  pageCount?: number
  processedPageCount?: number
  readMethod: UploadedAttachment['readMethod']
  runtimeLabel: string
  usedFallback: boolean
}

export interface GemmaIepTextReadingResult {
  diagnostics?: {
    draftHealth?: AccommodationDraftHealth
    finalAsset?: AccommodationImagePrepAsset
    focusedRecoveryTriggered?: boolean
    normalizedAsset?: AccommodationImagePrepAsset
    originalAsset?: AccommodationImagePrepAsset
    photoMode?: boolean
    preprocessRuntimeMs?: number
    selectedPassLabel?: string
  }
  extractedText: string
  modelLabel: string
  pageCount?: number
  processedPageCount?: number
  readMethod: UploadedAttachment['readMethod']
  runtimeLabel: string
  usedFallback: boolean
}

export interface GemmaReadingProgressUpdate {
  detail?: string
  label: string
  phase: AttachmentInterpretationPhase
  stepIndex?: number
  stepTotal?: number
}

export type GemmaReadingProgressReporter = (
  update: GemmaReadingProgressUpdate,
) => void

type SourceKey = 'iep' | 'task'

const DOCUMENT_SYSTEM_PROMPT = [
  'You are a careful document-reading assistant for IEP Compass.',
  'Look at the image and interpret what kind of school document it appears to be.',
  'Extract exact visible wording when you can, but also organize it into a structured review draft.',
  'Never invent diagnosis wording, accommodations, assignment directions, or missing document details.',
  'Never answer assignment, quiz, worksheet, or test questions.',
  'If text is blurry or unreadable, preserve [unclear] instead of guessing.',
  'For IEP accommodation forms: group accommodations by the visible section labels on the page when possible.',
  'For assignment uploads: do not perform full text extraction, but preserve short visible wording for key requirements, deadlines, grading factors, and directions.',
  'For assignment uploads: preserve visible title and label wording such as "Quiz Practice", "Areas of Circles", or "Composite Figures" inside taskDescription or evidenceBullets when visible.',
  'For assignment uploads: identify whether the visible page is assignment_details, assignment_page, rubric, worksheet, quiz, test, or unknown.',
  'For assignment uploads: describe the task type and visible access-relevant details, such as timing, rubric categories, spelling/mechanics grading, reading load, writing load, number of steps, required materials, or calculation focus.',
  'For assignment uploads: include short student-facing followUpQuestions that would clarify accommodation relevance, such as "Check whether this task is timed.", "Write how many minutes you have if this task is timed.", or "Check whether your accommodations should be matched to this practice work, the actual quiz/test, or both.".',
  'For assignment uploads: use accommodationFocus to capture whether the accommodation check should focus on assignment, practice, quiz, test, or unknown.',
  'For assignment uploads: use timeLimitMinutes only when a visible time limit is clear; otherwise use null and ask a follow-up question.',
  'Use cautious inference for task traits. If something is not visible enough, leave it empty or mark it unknown.',
  'Return JSON only with one of these document kinds: iep_accommodations, assignment_or_quiz, unknown.',
  'Every reviewDraft must include sourceSummaryText as a normalized text summary for downstream mapping.',
  'Use this exact top-level JSON shape: {"documentKind":"assignment_or_quiz","confidenceFlags":{"containsUnclearText":false,"isPartialDocument":false,"lowConfidence":false},"notes":[],"rawTranscript":"visible wording only","reviewDraft":{...}}.',
  'For assignment_or_quiz reviewDraft, include: taskDescription, subject, topic, workType, visibleDocumentType, timedStatus, timeLimitMinutes, calculationFocus, accommodationFocus, accessRelevantDetails, evidenceBullets, followUpQuestions, sourceSummaryText.',
].join('\n')

const TASK_TEXT_SYSTEM_PROMPT = [
  'You are a careful document-reading assistant for IEP Compass.',
  'Look at the image and describe the visible school task document in short plain text.',
  'Do not return JSON, markdown, code fences, or a schema.',
  'Do not transcribe the whole page.',
  'Never answer worksheet, quiz, assignment, or test questions.',
  'Focus on document type, task summary, subject/topic if visible, timing clues, rubric or grading factors, calculation focus, and what a student or family should confirm before matching accommodations.',
  'If the page is unreadable or does not appear to be schoolwork, say that plainly instead of guessing.',
].join('\n')

const TASK_IMAGE_LONG_SIDE = 1280
const TASK_IMAGE_MAX_BYTES = 750_000
const TASK_IMAGE_QUALITY = 0.75

function formatModelLabel(model: string) {
  return model
}

function logGemmaStage(stage: string, details: Record<string, unknown> = {}) {
  console.debug('[IEP Compass Gemma]', stage, details)
}

function warnGemmaStage(stage: string, details: Record<string, unknown> = {}) {
  console.warn('[IEP Compass Gemma]', stage, details)
}

function describeDataUrl(imageDataUrl: string) {
  const mimeMatch = imageDataUrl.match(/^data:([^;,]+)/)

  return {
    chars: imageDataUrl.length,
    mimeType: mimeMatch?.[1] ?? 'unknown',
  }
}

function describeAsset(asset?: AccommodationImagePrepAsset) {
  if (!asset) {
    return undefined
  }

  return {
    bytes: asset.bytes,
    dimensions: asset.dimensions,
    mimeType: asset.mimeType,
  }
}

function describeRuntime(baseUrl?: string) {
  if (!baseUrl) {
    return 'Unavailable'
  }

  if (/^\/(?!\/)/.test(baseUrl)) {
    return 'Configured route'
  }

  return /localhost:11434|127\.0\.0\.1:11434/i.test(baseUrl)
    ? 'Local Ollama'
    : 'Configured endpoint'
}

function readConfig(): GemmaDocumentConfig {
  const baseUrl = import.meta.env.VITE_GEMMA_BASE_URL?.trim()
  const hasLocalRoute = Boolean(baseUrl && /^\/(?!\/)/.test(baseUrl))
  const hasLocalHost = Boolean(
    baseUrl && /localhost:11434|127\.0\.0\.1:11434/i.test(baseUrl),
  )
  const primaryModel =
    import.meta.env.VITE_GEMMA_APP_MODEL?.trim()
    || import.meta.env.VITE_GEMMA_PRIMARY_MODEL?.trim()
    || GEMMA_LOCAL_MODEL_ID

  return {
    apiKey: import.meta.env.VITE_GEMMA_API_KEY?.trim(),
    baseUrl,
    fallbackModel: import.meta.env.VITE_GEMMA_FALLBACK_MODEL?.trim() || undefined,
    isRemote: Boolean(baseUrl) && !hasLocalRoute && !hasLocalHost,
    primaryModel,
    runtimeLabel: describeRuntime(baseUrl),
  }
}

function extractPlainText(content: string) {
  const fencedMatch = content.match(/```(?:text|txt|markdown)?\s*([\s\S]*?)```/i)
  return fencedMatch ? fencedMatch[1].trim() : content.trim()
}

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return headers
}

function buildDocumentReadingInstruction(
  attachmentName: string,
  kind: UploadedAttachment['kind'],
  sourceKey: SourceKey,
  pageIndex?: number,
  pageCount?: number,
) {
  const sourceExpectation =
    sourceKey === 'iep'
      ? [
          'This upload was added under the approved IEP source area.',
          'Prefer iep_accommodations when the page looks like an accommodations form or excerpt, but return unknown if that is not actually visible.',
        ]
      : [
          'This upload was added under the assignment or quiz source area.',
          'Prefer assignment_or_quiz when the page looks like classwork, a worksheet, a quiz, or a test, but return unknown if that is not actually visible.',
          'For the assignment reviewDraft, include visibleDocumentType, accommodationFocus, timeLimitMinutes, accessRelevantDetails, and followUpQuestions.',
          'If the page shows quiz practice, add a student-facing prompt to check whether the accommodation match should focus on the practice sheet, the quiz itself, or both.',
          'If timing is visible or likely but not fully confirmed, add student-facing prompts to check whether it is timed and write how many minutes they have.',
          'If the page appears to be a worksheet, quiz, test, practice sheet, assignment page, or schoolwork, return assignment_or_quiz even when some text is unreadable.',
          'For task uploads, never return a blank review draft. If you cannot read enough detail, fill taskDescription with a cautious visible summary and add followUpQuestions for the missing context.',
        ]

  const pageInstruction =
    kind === 'pdf' && pageIndex && pageCount
      ? `This image is page ${pageIndex} of ${pageCount} from the PDF "${attachmentName}".`
      : `This image comes from the uploaded ${kind} file "${attachmentName}".`

  return [
    pageInstruction,
    ...sourceExpectation,
    'Read the visible page carefully and build the structured document review result.',
    'Keep the rawTranscript faithful to the visible wording.',
    'For task pages, do not decide the final accommodation mapping here. Only summarize the task, visible traits, relevant details, and short follow-up questions.',
    'Every text field shown to the user should contain useful reviewable wording when the page is schoolwork; do not leave the review draft blank.',
  ].join(' ')
}

function buildTaskTextReadingInstruction(
  attachmentName: string,
  kind: UploadedAttachment['kind'],
  pageIndex?: number,
  pageCount?: number,
) {
  const pageInstruction =
    kind === 'pdf' && pageIndex && pageCount
      ? `This image is page ${pageIndex} of ${pageCount} from the PDF "${attachmentName}".`
      : `This image comes from the uploaded ${kind} file "${attachmentName}".`

  return [
    pageInstruction,
    'Return 4 to 8 short plain-text lines.',
    'Include the visible document kind if you can tell: assignment details, assignment page, rubric, worksheet, quiz, test, practice, or unknown.',
    'Include a cautious task summary based only on what is visible.',
    'Include access-relevant details such as timing, reading load, writing load, multi-step directions, rubric categories, required materials, allowed tools, or calculation focus.',
    'Include short student-facing follow-up prompts for unclear context, especially whether a practice page should be checked as practice or for the actual quiz/test, and whether the task is timed.',
    'Use [unclear] for important details that appear present but unreadable.',
  ].join(' ')
}


function buildIepTextReadingInstruction(
  attachmentName: string,
  kind: UploadedAttachment['kind'],
  pageIndex?: number,
  pageCount?: number,
  photoMode?: boolean,
) {
  return buildAccommodationExtractionPrompt({
    attachmentKind: kind,
    attachmentName,
    pageCount,
    pageIndex,
  }, {
    photoMode,
  })
}

function buildFocusedIepTextReadingInstruction(
  attachmentName: string,
  kind: UploadedAttachment['kind'],
  pageIndex?: number,
  pageCount?: number,
  options?: {
    conditionFocus?: boolean
    photoMode?: boolean
  },
) {
  return buildAccommodationFocusedExtractionPrompt({
    attachmentKind: kind,
    attachmentName,
    pageCount,
    pageIndex,
  }, options)
}

async function fileToDataUrl(file: File) {
  return blobToDataUrl(file)
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('The image could not be prepared for document reading.'))
    }

    reader.onerror = () => {
      reject(new Error('The image could not be prepared for document reading.'))
    }

    reader.readAsDataURL(blob)
  })
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('The image could not be prepared for document reading.'))
          return
        }

        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

function getImageMimeType(file: File) {
  return file.type || 'image/jpeg'
}

async function inspectBrowserImageFile(file: File): Promise<AccommodationImagePrepAsset> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()

      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The image could not be prepared for document reading.'))
      element.src = objectUrl
    })

    return {
      bytes: file.size,
      dimensions: {
        height: image.naturalHeight,
        width: image.naturalWidth,
      },
      mimeType: getImageMimeType(file),
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function prepareTaskImageForReading(file: File) {
  const originalAsset = await inspectBrowserImageFile(file)
  const longSide = Math.max(
    originalAsset.dimensions.width,
    originalAsset.dimensions.height,
  )
  const shouldNormalize =
    longSide > TASK_IMAGE_LONG_SIDE
    || originalAsset.bytes > TASK_IMAGE_MAX_BYTES
    || !['image/jpeg', 'image/png', 'image/webp'].includes(originalAsset.mimeType)

  if (!shouldNormalize) {
    return {
      imageDataUrl: await fileToDataUrl(file),
      originalAsset,
      normalizedAsset: undefined,
    }
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()

      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The image could not be prepared for document reading.'))
      element.src = objectUrl
    })
    const scale = TASK_IMAGE_LONG_SIDE / longSide
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale))
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')

    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('The image could not be prepared for document reading.')
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    const normalizedBlob = await canvasToBlob(
      canvas,
      'image/jpeg',
      TASK_IMAGE_QUALITY,
    )

    return {
      imageDataUrl: await blobToDataUrl(normalizedBlob),
      normalizedAsset: {
        bytes: normalizedBlob.size,
        dimensions: {
          height: targetHeight,
          width: targetWidth,
        },
        mimeType: 'image/jpeg',
      },
      originalAsset,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function createRecoveryTileImagesFromCanvas(
  canvas: HTMLCanvasElement,
  mimeType: string,
) {
  const tileRects = getAccommodationPhotoRecoveryTileRects({
    height: canvas.height,
    width: canvas.width,
  })

  return Promise.all(tileRects.map(async (tileRect) => {
    const tileCanvas = document.createElement('canvas')

    tileCanvas.width = tileRect.width
    tileCanvas.height = tileRect.height

    const tileContext = tileCanvas.getContext('2d')

    if (!tileContext) {
      throw new Error('The image could not be prepared for document reading.')
    }

    tileContext.drawImage(
      canvas,
      tileRect.x,
      tileRect.y,
      tileRect.width,
      tileRect.height,
      0,
      0,
      tileRect.width,
      tileRect.height,
    )

    const tileBlob = await canvasToBlob(
      tileCanvas,
      mimeType,
      ACCOMMODATION_PHOTO_BROWSER_QUALITY,
    )

    return {
      asset: {
        bytes: tileBlob.size,
        dimensions: {
          height: tileRect.height,
          width: tileRect.width,
        },
        mimeType,
      },
      imageDataUrl: await blobToDataUrl(tileBlob),
      label: tileRect.label,
    }
  }))
}

async function prepareAccommodationImageForReading(file: File) {
  const originalAsset = await inspectBrowserImageFile(file)
  const prepDecision = getAccommodationImagePrepDecision(originalAsset)
  const originalImageDataUrl = await fileToDataUrl(file)

  if (!prepDecision.shouldNormalize) {
    return {
      finalAsset: originalAsset,
      imageDataUrl: originalImageDataUrl,
      normalizedAsset: undefined,
      normalizedImageDataUrl: undefined,
      originalAsset,
      originalImageDataUrl,
      photoMode: prepDecision.isPhotoMode,
      preprocessRuntimeMs: 0,
      focusedRecoveryAsset: originalAsset,
      focusedRecoveryImageDataUrl: originalImageDataUrl,
      focusedRecoveryTiles: undefined,
    }
  }

  const startedAt = Date.now()
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()

      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The image could not be prepared for document reading.'))
      element.src = objectUrl
    })
    const longSide = Math.max(image.naturalWidth, image.naturalHeight)
    const scale = prepDecision.targetLongSide / longSide
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale))
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')

    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('The image could not be prepared for document reading.')
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    const normalizedBlob = await canvasToBlob(
      canvas,
      prepDecision.normalizedMimeType,
      ACCOMMODATION_PHOTO_BROWSER_QUALITY,
    )
    const normalizedAsset: AccommodationImagePrepAsset = {
      bytes: normalizedBlob.size,
      dimensions: {
        height: targetHeight,
        width: targetWidth,
      },
      mimeType: prepDecision.normalizedMimeType,
    }
    const normalizedImageDataUrl = await blobToDataUrl(normalizedBlob)
    let focusedRecoveryAsset = normalizedAsset
    let focusedRecoveryImageDataUrl = normalizedImageDataUrl
    let focusedRecoveryTiles:
      | Array<{
        asset: AccommodationImagePrepAsset
        imageDataUrl: string
        label: AccommodationPhotoRecoveryTileLabel
      }>
      | undefined

    if (prepDecision.isPhotoMode) {
      const rotatedCanvas = document.createElement('canvas')

      rotatedCanvas.width = targetHeight
      rotatedCanvas.height = targetWidth

      const rotatedContext = rotatedCanvas.getContext('2d')

      if (!rotatedContext) {
        throw new Error('The image could not be prepared for document reading.')
      }

      rotatedContext.translate(0, targetWidth)
      rotatedContext.rotate(-Math.PI / 2)
      rotatedContext.drawImage(canvas, 0, 0)

      const rotatedBlob = await canvasToBlob(
        rotatedCanvas,
        prepDecision.normalizedMimeType,
        ACCOMMODATION_PHOTO_BROWSER_QUALITY,
      )

      focusedRecoveryAsset = {
        bytes: rotatedBlob.size,
        dimensions: {
          height: targetWidth,
          width: targetHeight,
        },
        mimeType: prepDecision.normalizedMimeType,
      }
      focusedRecoveryImageDataUrl = await blobToDataUrl(rotatedBlob)

      const cropHeight = Math.max(
        1,
        Math.min(
          rotatedCanvas.height,
          Math.round(rotatedCanvas.height * ACCOMMODATION_PHOTO_RECOVERY_CROP_RATIO),
        ),
      )
      const croppedCanvas = document.createElement('canvas')

      croppedCanvas.width = rotatedCanvas.width
      croppedCanvas.height = cropHeight

      const croppedContext = croppedCanvas.getContext('2d')

      if (!croppedContext) {
        throw new Error('The image could not be prepared for document reading.')
      }

      croppedContext.drawImage(
        rotatedCanvas,
        0,
        0,
        rotatedCanvas.width,
        cropHeight,
        0,
        0,
        rotatedCanvas.width,
        cropHeight,
      )

      const croppedBlob = await canvasToBlob(
        croppedCanvas,
        prepDecision.normalizedMimeType,
        ACCOMMODATION_PHOTO_BROWSER_QUALITY,
      )

      focusedRecoveryAsset = {
        bytes: croppedBlob.size,
        dimensions: {
          height: cropHeight,
          width: rotatedCanvas.width,
        },
        mimeType: prepDecision.normalizedMimeType,
      }
      focusedRecoveryImageDataUrl = await blobToDataUrl(croppedBlob)
      focusedRecoveryTiles = await createRecoveryTileImagesFromCanvas(
        croppedCanvas,
        prepDecision.normalizedMimeType,
      )
    }

    return {
      finalAsset: normalizedAsset,
      focusedRecoveryAsset,
      focusedRecoveryImageDataUrl,
      focusedRecoveryTiles,
      imageDataUrl: normalizedImageDataUrl,
      normalizedAsset,
      normalizedImageDataUrl,
      originalAsset,
      originalImageDataUrl,
      photoMode: prepDecision.isPhotoMode,
      preprocessRuntimeMs: Date.now() - startedAt,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function requestDocumentReading(options: {
  baseUrl: string
  headers: HeadersInit
  imageDataUrl: string
  instruction: string
  model: string
}) {
  logGemmaStage('provider_request_start', {
    image: describeDataUrl(options.imageDataUrl),
    instructionChars: options.instruction.length,
    model: options.model,
    requestKind: 'document_json',
  })

  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages: [
        {
          content: DOCUMENT_SYSTEM_PROMPT,
          role: 'system',
        },
        {
          content: [
            {
              text: options.instruction,
              type: 'text',
            },
            {
              image_url: {
                url: options.imageDataUrl,
              },
              type: 'image_url',
            },
          ],
          role: 'user',
        },
      ],
      model: options.model,
      response_format: {
        type: 'json_object',
      },
      stream: false,
      temperature: 0.1,
    }),
    headers: options.headers,
    method: 'POST',
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')

    warnGemmaStage('provider_request_failed', {
      detailChars: details.length,
      model: options.model,
      requestKind: 'document_json',
      status: response.status,
    })
    throw new Error(`Gemma document reading request failed with ${response.status}.`)
  }

  const payload = (await response.json()) as OpenAICompatibleResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    warnGemmaStage('provider_response_empty', {
      payloadKeys: describeObjectKeys(payload),
      requestKind: 'document_json',
    })
    throw new Error('Gemma document reading did not return message content.')
  }

  logGemmaStage('provider_raw_response_received', {
    contentChars: content.length,
    payloadKeys: describeObjectKeys(payload),
    requestKind: 'document_json',
  })

  try {
    const rawJson = parseJsonFromModelOutput(content)

    logGemmaStage('provider_response_parsed', {
      rawJsonKeys: describeObjectKeys(rawJson),
      requestKind: 'document_json',
    })

    const parsedResult = parseDocumentReadingResult(rawJson)

    logGemmaStage('provider_response_normalized', {
      confidenceFlags: parsedResult.confidenceFlags,
      documentKind: parsedResult.documentKind,
      notesCount: parsedResult.notes.length,
      reviewDraftKeys: describeObjectKeys(parsedResult.reviewDraft),
    })

    return parsedResult
  } catch (error) {
    warnGemmaStage('provider_response_parse_failed', {
      contentChars: content.length,
      error: error instanceof Error ? error.message : String(error),
      requestKind: 'document_json',
    })
    throw new Error(
      `Gemma document reading returned output the app could not parse: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

async function requestIepTextReading(options: {
  baseUrl: string
  headers: HeadersInit
  imageDataUrl: string
  instruction: string
  model: string
  temperature?: number
}) {
  logGemmaStage('provider_request_start', {
    image: describeDataUrl(options.imageDataUrl),
    instructionChars: options.instruction.length,
    model: options.model,
    requestKind: 'iep_plain_text',
  })

  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages: [
        {
          content: ACCOMMODATION_EXTRACTION_SYSTEM_PROMPT,
          role: 'system',
        },
        {
          content: [
            {
              text: options.instruction,
              type: 'text',
            },
            {
              image_url: {
                url: options.imageDataUrl,
              },
              type: 'image_url',
            },
          ],
          role: 'user',
        },
      ],
      model: options.model,
      stream: false,
      temperature: options.temperature ?? 0,
    }),
    headers: options.headers,
    method: 'POST',
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')

    warnGemmaStage('provider_request_failed', {
      detailChars: details.length,
      model: options.model,
      requestKind: 'iep_plain_text',
      status: response.status,
    })
    throw new Error(`Gemma IEP text reading request failed with ${response.status}.`)
  }

  const payload = (await response.json()) as OpenAICompatibleResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    warnGemmaStage('provider_response_empty', {
      payloadKeys: describeObjectKeys(payload),
      requestKind: 'iep_plain_text',
    })
    throw new Error('Gemma IEP text reading did not return message content.')
  }

  const extractedText = extractPlainText(content).trim()

  logGemmaStage('provider_raw_response_received', {
    contentChars: content.length,
    extractedChars: extractedText.length,
    payloadKeys: describeObjectKeys(payload),
    requestKind: 'iep_plain_text',
  })

  if (!extractedText) {
    throw new Error('Gemma IEP text reading returned blank extracted text.')
  }

  return extractedText
}

async function requestTaskTextReading(options: {
  baseUrl: string
  headers: HeadersInit
  imageDataUrl: string
  instruction: string
  model: string
  temperature?: number
}) {
  logGemmaStage('provider_request_start', {
    image: describeDataUrl(options.imageDataUrl),
    instructionChars: options.instruction.length,
    model: options.model,
    requestKind: 'task_plain_text',
  })

  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      messages: [
        {
          content: TASK_TEXT_SYSTEM_PROMPT,
          role: 'system',
        },
        {
          content: [
            {
              text: options.instruction,
              type: 'text',
            },
            {
              image_url: {
                url: options.imageDataUrl,
              },
              type: 'image_url',
            },
          ],
          role: 'user',
        },
      ],
      model: options.model,
      stream: false,
      temperature: options.temperature ?? 0,
    }),
    headers: options.headers,
    method: 'POST',
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')

    warnGemmaStage('provider_request_failed', {
      detailChars: details.length,
      model: options.model,
      requestKind: 'task_plain_text',
      status: response.status,
    })
    throw new Error(`Gemma task reading request failed with ${response.status}.`)
  }

  const payload = (await response.json()) as OpenAICompatibleResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    warnGemmaStage('provider_response_empty', {
      payloadKeys: describeObjectKeys(payload),
      requestKind: 'task_plain_text',
    })
    throw new Error('Gemma task reading did not return message content.')
  }

  const extractedText = extractPlainText(content).trim()

  logGemmaStage('provider_raw_response_received', {
    contentChars: content.length,
    extractedChars: extractedText.length,
    payloadKeys: describeObjectKeys(payload),
    requestKind: 'task_plain_text',
  })

  if (!extractedText) {
    throw new Error('Gemma task reading returned blank task notes.')
  }

  return extractedText
}

async function requestWithFallback(
  config: GemmaDocumentConfig,
  imageDataUrl: string,
  instruction: string,
  options: {
    attachmentName: string
    sourceKey: SourceKey
  },
) {
  if (!config.baseUrl) {
    throw new Error('Gemma document reading is not configured for this session.')
  }

  const headers = buildHeaders(config.apiKey)

  try {
    const result = await requestDocumentReading({
      baseUrl: config.baseUrl,
      headers,
      imageDataUrl,
      instruction,
      model: config.primaryModel,
    })

    return {
      modelLabel: formatModelLabel(config.primaryModel),
      result: recoverBlankTaskDocumentResult(
        result,
        options.attachmentName,
        options.sourceKey,
      ),
      usedFallback: false,
    }
  } catch (primaryError) {
    warnGemmaStage('provider_primary_failed', {
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      fallbackConfigured: Boolean(config.fallbackModel),
      model: config.primaryModel,
      requestKind: 'document_json',
    })

    if (!config.fallbackModel) {
      throw primaryError
    }

    const result = await requestDocumentReading({
      baseUrl: config.baseUrl,
      headers,
      imageDataUrl,
      instruction,
      model: config.fallbackModel,
    })

    return {
      modelLabel: formatModelLabel(config.fallbackModel),
      result: recoverBlankTaskDocumentResult(
        result,
        options.attachmentName,
        options.sourceKey,
      ),
      usedFallback: true,
    }
  }
}

async function requestTaskTextWithFallback(
  config: GemmaDocumentConfig,
  imageDataUrl: string,
  instruction: string,
) {
  if (!config.baseUrl) {
    throw new Error('Gemma document reading is not configured for this session.')
  }

  const headers = buildHeaders(config.apiKey)

  try {
    const result = await requestTaskTextReading({
      baseUrl: config.baseUrl,
      headers,
      imageDataUrl,
      instruction,
      model: config.primaryModel,
      temperature: 0,
    })

    return {
      modelLabel: formatModelLabel(config.primaryModel),
      result,
      usedFallback: false,
    }
  } catch (primaryError) {
    warnGemmaStage('provider_primary_failed', {
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      fallbackConfigured: Boolean(config.fallbackModel),
      model: config.primaryModel,
      requestKind: 'task_plain_text',
    })

    if (!config.fallbackModel) {
      throw primaryError
    }

    const result = await requestTaskTextReading({
      baseUrl: config.baseUrl,
      headers,
      imageDataUrl,
      instruction,
      model: config.fallbackModel,
      temperature: 0,
    })

    return {
      modelLabel: formatModelLabel(config.fallbackModel),
      result,
      usedFallback: true,
    }
  }
}

async function requestIepTextWithFallback(
  config: GemmaDocumentConfig,
  imageDataUrl: string,
  instruction: string,
  temperature?: number,
) {
  if (!config.baseUrl) {
    throw new Error('Gemma document reading is not configured for this session.')
  }

  const headers = buildHeaders(config.apiKey)

  try {
    const result = await requestIepTextReading({
      baseUrl: config.baseUrl,
      headers,
      imageDataUrl,
      instruction,
      model: config.primaryModel,
      temperature,
    })

    return {
      modelLabel: formatModelLabel(config.primaryModel),
      result,
      usedFallback: false,
    }
  } catch (primaryError) {
    warnGemmaStage('provider_primary_failed', {
      error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      fallbackConfigured: Boolean(config.fallbackModel),
      model: config.primaryModel,
      requestKind: 'iep_plain_text',
    })

    if (!config.fallbackModel) {
      throw primaryError
    }

    const result = await requestIepTextReading({
      baseUrl: config.baseUrl,
      headers,
      imageDataUrl,
      instruction,
      model: config.fallbackModel,
      temperature,
    })

    return {
      modelLabel: formatModelLabel(config.fallbackModel),
      result,
      usedFallback: true,
    }
  }
}

async function runIepTextReadingPasses(options: {
  config: GemmaDocumentConfig
  finalAsset?: AccommodationImagePrepAsset
  focusedRecoveryAsset?: AccommodationImagePrepAsset
  focusedRecoveryTiles?: Array<{
    asset: AccommodationImagePrepAsset
    imageDataUrl: string
    instruction: string
    label: AccommodationPhotoRecoveryTileLabel
  }>
  normalizedAsset?: AccommodationImagePrepAsset
  originalAsset?: AccommodationImagePrepAsset
  passes: Array<{
    imageDataUrl: string
    instruction: string
    label: string
  }>
  photoMode?: boolean
  onProgress?: GemmaReadingProgressReporter
  preprocessRuntimeMs?: number
}) {
  const drafts: string[] = []
  const passOutputs: Array<{
    label: string
    output: string
  }> = []
  let modelLabel = formatModelLabel(options.config.primaryModel)
  let usedFallback = false
  let focusedRecoveryTriggered = false
  const runPass = async (pass: {
    detail?: string
    imageDataUrl: string
    instruction: string
    label: string
    phase?: AttachmentInterpretationPhase
    stepIndex?: number
    stepTotal?: number
  }) => {
    options.onProgress?.({
      detail: pass.detail,
      label:
        pass.phase === 'focused_recovery'
          ? 'Scanning a focused part of the picture'
          : 'Scanning the picture with Gemma',
      phase: pass.phase ?? 'scanning_image',
      stepIndex: pass.stepIndex,
      stepTotal: pass.stepTotal,
    })

    const response = await requestIepTextWithFallback(
      options.config,
      pass.imageDataUrl,
      pass.instruction,
      0,
    )
    const trimmedResult = response.result.trim()

    drafts.push(trimmedResult)
    passOutputs.push({
      label: pass.label,
      output: trimmedResult,
    })
    modelLabel = response.modelLabel
    usedFallback = usedFallback || response.usedFallback

    return trimmedResult
  }

  const firstPass = options.passes[0]

  if (!firstPass) {
    throw new Error('No IEP text reading passes were configured.')
  }

  const estimatedStepTotal = 2 + (options.focusedRecoveryTiles?.length ?? 1)
  const firstPassResult = await runPass({
    ...firstPass,
    detail: 'Reading the visible accommodations and preserving unclear wording instead of guessing.',
    phase: 'scanning_image',
    stepIndex: 2,
    stepTotal: estimatedStepTotal,
  })
  const draftHealth: AccommodationDraftHealth | undefined
    = assessAccommodationDraftHealth(firstPassResult)

  focusedRecoveryTriggered = shouldTriggerAccommodationFocusedRecovery(firstPassResult, {
    isPhotoMode: Boolean(options.photoMode),
  })

  if (focusedRecoveryTriggered && options.focusedRecoveryTiles?.length) {
    const tileDrafts: Array<{
      label: AccommodationPhotoRecoveryTileLabel
      text: string
    }> = []

    for (const [tileIndex, tile] of options.focusedRecoveryTiles.entries()) {
      try {
        const tileOutput = await runPass({
          detail:
            tile.label === 'student_response_conditions'
              ? 'Checking the student-response condition wording more closely.'
              : 'Checking a smaller crop so faint accommodation rows are easier to read.',
          imageDataUrl: tile.imageDataUrl,
          instruction: tile.instruction,
          label: `focused_recovery_tile_${tile.label}`,
          phase: 'focused_recovery',
          stepIndex: 3 + tileIndex,
          stepTotal: estimatedStepTotal,
        })

        tileDrafts.push({
          label: tile.label,
          text: tileOutput,
        })
        drafts.pop()
        passOutputs.pop()
      } catch {
        continue
      }
    }

    const mergedTileDraft = mergeAccommodationPhotoRecoveryTileDrafts(tileDrafts)

    if (mergedTileDraft) {
      options.onProgress?.({
        detail: 'Combining the focused scans into one reviewable accommodations draft.',
        label: 'Putting the multiple outputs together',
        phase: 'combining_outputs',
        stepIndex: estimatedStepTotal,
        stepTotal: estimatedStepTotal,
      })

      drafts.push(mergedTileDraft)
      passOutputs.push({
        label: 'focused_recovery_tiled',
        output: mergedTileDraft,
      })
    } else if (options.passes[1]) {
      try {
        await runPass({
          ...options.passes[1],
          detail: 'Running one focused recovery pass before choosing the best draft.',
          phase: 'focused_recovery',
          stepIndex: 3,
          stepTotal: estimatedStepTotal,
        })
      } catch {
        focusedRecoveryTriggered = true
      }
    }
  } else if (focusedRecoveryTriggered && options.passes[1]) {
    try {
      await runPass({
        ...options.passes[1],
        detail: 'Running one focused recovery pass before choosing the best draft.',
        phase: 'focused_recovery',
        stepIndex: 3,
        stepTotal: estimatedStepTotal,
      })
    } catch {
      focusedRecoveryTriggered = true
    }
  }

  options.onProgress?.({
    detail: 'Choosing the clearest grounded draft for review.',
    label: 'Putting the multiple outputs together',
    phase: 'combining_outputs',
    stepIndex: focusedRecoveryTriggered ? estimatedStepTotal : 3,
    stepTotal: focusedRecoveryTriggered ? estimatedStepTotal : 3,
  })

  const selectedOutput = selectAccommodationDraft(drafts)
  const selectedPass =
    passOutputs.find((passOutput) => passOutput.output === selectedOutput)?.label || 'full'

  return {
    diagnostics: {
      draftHealth,
      finalAsset:
        selectedPass.startsWith('focused_recovery')
          ? (options.focusedRecoveryAsset || options.normalizedAsset || options.finalAsset || options.originalAsset)
          : (options.originalAsset || options.finalAsset),
      focusedRecoveryTriggered,
      normalizedAsset: options.normalizedAsset,
      originalAsset: options.originalAsset,
      photoMode: options.photoMode,
      preprocessRuntimeMs: options.preprocessRuntimeMs,
      selectedPassLabel: selectedPass,
    },
    extractedText: selectedOutput,
    modelLabel,
    usedFallback,
  }
}

function mergeDocumentResults(results: DocumentReadingResult[]): DocumentReadingResult {
  const firstResult = results[0]

  if (!firstResult) {
    throw new Error('No document-reading result was available.')
  }

  if (results.length === 1) {
    return firstResult
  }

  if (firstResult.documentKind === 'assignment_or_quiz') {
    const assignmentResults = results.filter(
      (result): result is Extract<DocumentReadingResult, { documentKind: 'assignment_or_quiz' }> =>
        result.documentKind === 'assignment_or_quiz',
    )
    const uniqueStrings = (items: string[]) =>
      Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))
    const firstDraft = firstResult.reviewDraft
    const taskDescription = uniqueStrings(
      assignmentResults.map((result) => result.reviewDraft.taskDescription),
    ).join('\n\n')

    return {
      ...firstResult,
      confidenceFlags: {
        containsUnclearText: results.some(
          (result) => result.confidenceFlags.containsUnclearText,
        ),
        isPartialDocument: results.some(
          (result) => result.confidenceFlags.isPartialDocument,
        ),
        lowConfidence: results.some((result) => result.confidenceFlags.lowConfidence),
      },
      notes: Array.from(new Set(results.flatMap((result) => result.notes))),
      rawTranscript: results
        .map((result, index) => `[PDF page ${index + 1}]\n${result.rawTranscript.trim()}`)
        .join('\n\n'),
      reviewDraft: {
        ...firstDraft,
        accessRelevantDetails: uniqueStrings(
          assignmentResults.flatMap((result) => result.reviewDraft.accessRelevantDetails),
        ),
        accommodationFocus:
          assignmentResults.find((result) =>
            result.reviewDraft.accommodationFocus !== 'unknown',
          )?.reviewDraft.accommodationFocus ?? firstDraft.accommodationFocus,
        evidenceBullets: uniqueStrings(
          assignmentResults.flatMap((result) => result.reviewDraft.evidenceBullets),
        ),
        followUpQuestions: uniqueStrings(
          assignmentResults.flatMap((result) => result.reviewDraft.followUpQuestions),
        ),
        taskDescription: taskDescription || firstDraft.taskDescription,
        timeLimitMinutes:
          assignmentResults.find((result) =>
            typeof result.reviewDraft.timeLimitMinutes === 'number',
          )?.reviewDraft.timeLimitMinutes ?? firstDraft.timeLimitMinutes,
      },
    }
  }

  if (firstResult.documentKind !== 'iep_accommodations') {
    return {
      ...firstResult,
      confidenceFlags: {
        containsUnclearText: results.some(
          (result) => result.confidenceFlags.containsUnclearText,
        ),
        isPartialDocument: results.some(
          (result) => result.confidenceFlags.isPartialDocument,
        ),
        lowConfidence: results.some((result) => result.confidenceFlags.lowConfidence),
      },
      notes: Array.from(new Set(results.flatMap((result) => result.notes))),
      rawTranscript: results
        .map((result, index) => `[PDF page ${index + 1}]\n${result.rawTranscript.trim()}`)
        .join('\n\n'),
    }
  }

  const combinedSections = new Map<string, string[]>()
  const learningDisabilityOrProfileText = new Set<string>()
  const modifications = new Set<string>()

  results.forEach((result) => {
    if (result.documentKind !== 'iep_accommodations') {
      return
    }

    result.reviewDraft.sections.forEach((section) => {
      const currentItems = combinedSections.get(section.title) ?? []
      combinedSections.set(
        section.title,
        Array.from(new Set(currentItems.concat(section.items))),
      )
    })

    result.reviewDraft.learningDisabilityOrProfileText.forEach((item) => {
      learningDisabilityOrProfileText.add(item)
    })

    result.reviewDraft.modifications.forEach((item) => {
      modifications.add(item)
    })
  })

  return {
    confidenceFlags: {
      containsUnclearText: results.some(
        (result) => result.confidenceFlags.containsUnclearText,
      ),
      isPartialDocument: results.some(
        (result) => result.confidenceFlags.isPartialDocument,
      ),
      lowConfidence: results.some((result) => result.confidenceFlags.lowConfidence),
    },
    documentKind: 'iep_accommodations',
    notes: Array.from(new Set(results.flatMap((result) => result.notes))),
    rawTranscript: results
      .map((result, index) => `[PDF page ${index + 1}]\n${result.rawTranscript.trim()}`)
      .join('\n\n'),
    reviewDraft: {
      ...firstResult.reviewDraft,
      learningDisabilityOrProfileText: Array.from(learningDisabilityOrProfileText),
      modifications: Array.from(modifications),
      sections: Array.from(combinedSections.entries()).map(([title, items]) => ({
        items,
        title,
      })),
    },
  }
}

export function readGemmaDocumentPlan(): GemmaDocumentPlan {
  const config = readConfig()

  return {
    configured: Boolean(config.baseUrl),
    isRemote: config.isRemote,
    primaryModel: formatModelLabel(config.primaryModel),
    runtimeLabel: config.runtimeLabel,
  }
}

export async function runGemmaDocumentReading(
  attachment: Pick<UploadedAttachment, 'file' | 'kind' | 'name'>,
  sourceKey: SourceKey,
  onProgress?: GemmaReadingProgressReporter,
): Promise<GemmaDocumentReadingResult> {
  const config = readConfig()

  logGemmaStage('analysis_started', {
    attachmentKind: attachment.kind,
    model: config.primaryModel,
    runtimeLabel: config.runtimeLabel,
    sourceKey,
  })

  onProgress?.({
    detail: `Using ${formatModelLabel(config.primaryModel)} through ${config.runtimeLabel}.`,
    label: 'Getting Gemma ready',
    phase: 'checking_model',
    stepIndex: 1,
    stepTotal: attachment.kind === 'pdf' ? undefined : 3,
  })

  if (!config.baseUrl) {
    throw new Error('Gemma document reading is not configured yet for this session.')
  }

  if (attachment.kind !== 'image' && attachment.kind !== 'pdf') {
    throw new Error('Gemma document reading only supports images and PDFs in this phase.')
  }

  if (attachment.kind === 'image') {
    onProgress?.({
      detail: 'Preparing the image so Gemma can read the visible school document.',
      label: 'Preparing the picture',
      phase: 'preparing_image',
      stepIndex: 1,
      stepTotal: 3,
    })

    const preparedImage = sourceKey === 'task'
      ? await prepareTaskImageForReading(attachment.file)
      : {
          imageDataUrl: await fileToDataUrl(attachment.file),
          normalizedAsset: undefined,
          originalAsset: undefined,
        }

    logGemmaStage('image_payload_prepared', {
      image: describeDataUrl(preparedImage.imageDataUrl),
      normalizedAsset: describeAsset(preparedImage.normalizedAsset),
      originalAsset: describeAsset(preparedImage.originalAsset),
      sourceKey,
    })

    onProgress?.({
      detail: 'Reading the visible task details and preserving unclear wording.',
      label: 'Scanning the picture with Gemma',
      phase: 'scanning_image',
      stepIndex: 2,
      stepTotal: 3,
    })

    const resolvedResponse =
      sourceKey === 'task'
        ? await requestTaskTextWithFallback(
            config,
            preparedImage.imageDataUrl,
            buildTaskTextReadingInstruction(attachment.name, attachment.kind),
          ).then((taskTextResponse) => ({
            modelLabel: taskTextResponse.modelLabel,
            result: buildTaskDocumentResultFromPlainText(
              taskTextResponse.result,
              attachment.name,
            ),
            usedFallback: taskTextResponse.usedFallback,
          }))
        : await requestWithFallback(
            config,
            preparedImage.imageDataUrl,
            buildDocumentReadingInstruction(attachment.name, attachment.kind, sourceKey),
            {
              attachmentName: attachment.name,
              sourceKey,
            },
          )

    logGemmaStage('analysis_completed', {
      documentKind: resolvedResponse.result.documentKind,
      readMethod: 'gemma4_image',
      reviewDraftKeys: describeObjectKeys(resolvedResponse.result.reviewDraft),
      sourceKey,
      usedFallback: resolvedResponse.usedFallback,
    })

    onProgress?.({
      detail: 'Turning Gemma output into the review draft shown below.',
      label: 'Putting the output together',
      phase: 'combining_outputs',
      stepIndex: 3,
      stepTotal: 3,
    })

    return {
      documentResult: resolvedResponse.result,
      modelLabel: resolvedResponse.modelLabel,
      readMethod: 'gemma4_image',
      runtimeLabel: config.runtimeLabel,
      usedFallback: resolvedResponse.usedFallback,
    }
  }

  onProgress?.({
    detail: 'Rendering the first PDF pages into images for Gemma.',
    label: 'Preparing the PDF pages',
    phase: 'preparing_pdf',
    stepIndex: 1,
  })

  const pdfPages = await renderPdfPagesToImageDataUrls(attachment.file)
  logGemmaStage('pdf_payload_prepared', {
    pageCount: pdfPages.pageCount,
    processedPageCount: pdfPages.processedPageCount,
    sourceKey,
  })
  const pageResults: DocumentReadingResult[] = []
  let modelLabel = formatModelLabel(config.primaryModel)
  let usedFallback = false

  for (let index = 0; index < pdfPages.imageDataUrls.length; index += 1) {
    onProgress?.({
      detail: `Reading page ${index + 1} of ${pdfPages.processedPageCount}.`,
      label: 'Scanning a PDF page with Gemma',
      phase: 'scanning_pdf_page',
      stepIndex: index + 2,
      stepTotal: pdfPages.processedPageCount + 2,
    })

    const response =
      sourceKey === 'task'
        ? await requestTaskTextWithFallback(
            config,
            pdfPages.imageDataUrls[index],
            buildTaskTextReadingInstruction(
              attachment.name,
              attachment.kind,
              index + 1,
              pdfPages.processedPageCount,
            ),
          ).then((taskTextResponse) => ({
            modelLabel: taskTextResponse.modelLabel,
            result: buildTaskDocumentResultFromPlainText(
              taskTextResponse.result,
              attachment.name,
            ),
            usedFallback: taskTextResponse.usedFallback,
          }))
        : await requestWithFallback(
            config,
            pdfPages.imageDataUrls[index],
            buildDocumentReadingInstruction(
              attachment.name,
              attachment.kind,
              sourceKey,
              index + 1,
              pdfPages.processedPageCount,
            ),
            {
              attachmentName: attachment.name,
              sourceKey,
            },
          )

    pageResults.push(response.result)
    modelLabel = response.modelLabel
    usedFallback = usedFallback || response.usedFallback

    await new Promise((resolve) => {
      window.setTimeout(resolve, 0)
    })
  }

  onProgress?.({
    detail: 'Combining the page readings into one review draft.',
    label: 'Putting the multiple outputs together',
    phase: 'combining_outputs',
    stepIndex: pdfPages.processedPageCount + 2,
    stepTotal: pdfPages.processedPageCount + 2,
  })

  const documentResult = mergeDocumentResults(pageResults)

  logGemmaStage('analysis_completed', {
    documentKind: documentResult.documentKind,
    pageCount: pdfPages.pageCount,
    processedPageCount: pdfPages.processedPageCount,
    readMethod: 'gemma4_pdf_pages',
    reviewDraftKeys: describeObjectKeys(documentResult.reviewDraft),
    sourceKey,
    usedFallback,
  })

  return {
    documentResult,
    modelLabel,
    pageCount: pdfPages.pageCount,
    processedPageCount: pdfPages.processedPageCount,
    readMethod: 'gemma4_pdf_pages',
    runtimeLabel: config.runtimeLabel,
    usedFallback,
  }
}

export async function runGemmaIepTextReading(
  attachment: Pick<UploadedAttachment, 'file' | 'kind' | 'name'>,
  onProgress?: GemmaReadingProgressReporter,
): Promise<GemmaIepTextReadingResult> {
  const config = readConfig()

  logGemmaStage('analysis_started', {
    attachmentKind: attachment.kind,
    model: config.primaryModel,
    runtimeLabel: config.runtimeLabel,
    sourceKey: 'iep',
  })

  onProgress?.({
    detail: `Using ${formatModelLabel(config.primaryModel)} through ${config.runtimeLabel}.`,
    label: 'Getting Gemma ready',
    phase: 'checking_model',
    stepIndex: 1,
    stepTotal: attachment.kind === 'pdf' ? undefined : 4,
  })

  if (!config.baseUrl) {
    throw new Error('Gemma document reading is not configured yet for this session.')
  }

  if (attachment.kind !== 'image' && attachment.kind !== 'pdf') {
    throw new Error('Gemma document reading only supports images and PDFs in this phase.')
  }

  if (attachment.kind === 'image') {
    onProgress?.({
      detail: 'Preparing the photo so the accommodations table is easier to read.',
      label: 'Preparing the picture',
      phase: 'preparing_image',
      stepIndex: 1,
      stepTotal: 4,
    })

    const preparedImage = await prepareAccommodationImageForReading(attachment.file)

    logGemmaStage('image_payload_prepared', {
      finalAsset: describeAsset(preparedImage.finalAsset),
      focusedRecoveryAsset: describeAsset(preparedImage.focusedRecoveryAsset),
      focusedRecoveryTileCount: preparedImage.focusedRecoveryTiles?.length ?? 0,
      image: describeDataUrl(preparedImage.originalImageDataUrl),
      normalizedAsset: describeAsset(preparedImage.normalizedAsset),
      originalAsset: describeAsset(preparedImage.originalAsset),
      photoMode: preparedImage.photoMode,
      sourceKey: 'iep',
    })

    const response = await runIepTextReadingPasses({
      config,
      finalAsset: preparedImage.finalAsset,
      focusedRecoveryAsset: preparedImage.focusedRecoveryAsset,
      focusedRecoveryTiles: preparedImage.focusedRecoveryTiles?.map((tile) => ({
        ...tile,
        instruction: buildFocusedIepTextReadingInstruction(
          attachment.name,
          attachment.kind,
          undefined,
          undefined,
          getAccommodationFocusedExtractionPromptOptionsForTile(
            tile.label,
            preparedImage.photoMode,
          ),
        ),
      })),
      normalizedAsset: preparedImage.normalizedAsset,
      originalAsset: preparedImage.originalAsset,
      passes: [
        {
          imageDataUrl: preparedImage.originalImageDataUrl,
          instruction: buildIepTextReadingInstruction(
            attachment.name,
            attachment.kind,
            undefined,
            undefined,
            preparedImage.photoMode,
          ),
          label: 'full',
        },
        {
          imageDataUrl:
            preparedImage.focusedRecoveryImageDataUrl
            || preparedImage.normalizedImageDataUrl
            || preparedImage.originalImageDataUrl,
          instruction: preparedImage.photoMode
            ? buildIepTextReadingInstruction(
                attachment.name,
                attachment.kind,
                undefined,
                undefined,
                true,
              )
            : buildFocusedIepTextReadingInstruction(
                attachment.name,
                attachment.kind,
                undefined,
                undefined,
                {
                  photoMode: false,
                },
              ),
          label: 'focused_recovery',
        },
      ],
      onProgress,
      photoMode: preparedImage.photoMode,
      preprocessRuntimeMs: preparedImage.preprocessRuntimeMs,
    })

    logGemmaStage('analysis_completed', {
      extractedChars: response.extractedText.length,
      readMethod: 'gemma4_image',
      selectedPassLabel: response.diagnostics.selectedPassLabel,
      sourceKey: 'iep',
      usedFallback: response.usedFallback,
    })

    return {
      diagnostics: response.diagnostics,
      extractedText: response.extractedText,
      modelLabel: response.modelLabel,
      readMethod: 'gemma4_image',
      runtimeLabel: config.runtimeLabel,
      usedFallback: response.usedFallback,
    }
  }

  onProgress?.({
    detail: 'Rendering the first PDF pages into images for Gemma.',
    label: 'Preparing the PDF pages',
    phase: 'preparing_pdf',
    stepIndex: 1,
  })

  const pdfPages = await renderPdfPagesToImageDataUrls(attachment.file)
  logGemmaStage('pdf_payload_prepared', {
    pageCount: pdfPages.pageCount,
    processedPageCount: pdfPages.processedPageCount,
    sourceKey: 'iep',
  })
  const pageTexts: string[] = []
  let modelLabel = formatModelLabel(config.primaryModel)
  let usedFallback = false

  for (let index = 0; index < pdfPages.imageDataUrls.length; index += 1) {
    onProgress?.({
      detail: `Reading accommodations page ${index + 1} of ${pdfPages.processedPageCount}.`,
      label: 'Scanning a PDF page with Gemma',
      phase: 'scanning_pdf_page',
      stepIndex: index + 2,
      stepTotal: pdfPages.processedPageCount + 2,
    })

    const response = await runIepTextReadingPasses({
      config,
      passes: [
        {
          imageDataUrl: pdfPages.imageDataUrls[index],
          instruction: buildIepTextReadingInstruction(
            attachment.name,
            attachment.kind,
            index + 1,
            pdfPages.processedPageCount,
          ),
          label: 'full',
        },
        {
          imageDataUrl: pdfPages.imageDataUrls[index],
          instruction: buildFocusedIepTextReadingInstruction(
            attachment.name,
            attachment.kind,
            index + 1,
            pdfPages.processedPageCount,
            {},
          ),
          label: 'focused_recovery',
        },
      ],
    })

    pageTexts.push(response.extractedText)
    modelLabel = response.modelLabel
    usedFallback = usedFallback || response.usedFallback

    await new Promise((resolve) => {
      window.setTimeout(resolve, 0)
    })
  }

  onProgress?.({
    detail: 'Combining the page readings into one accommodations draft.',
    label: 'Putting the multiple outputs together',
    phase: 'combining_outputs',
    stepIndex: pdfPages.processedPageCount + 2,
    stepTotal: pdfPages.processedPageCount + 2,
  })

  const extractedText = pageTexts.map((text) => text.trim()).filter(Boolean).join('\n\n')

  logGemmaStage('analysis_completed', {
    extractedChars: extractedText.length,
    pageCount: pdfPages.pageCount,
    processedPageCount: pdfPages.processedPageCount,
    readMethod: 'gemma4_pdf_pages',
    sourceKey: 'iep',
    usedFallback,
  })

  return {
    extractedText,
    modelLabel,
    pageCount: pdfPages.pageCount,
    processedPageCount: pdfPages.processedPageCount,
    readMethod: 'gemma4_pdf_pages',
    runtimeLabel: config.runtimeLabel,
    usedFallback,
  }
}
