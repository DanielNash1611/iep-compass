import {
  parseDocumentReadingResult,
  type DocumentReadingResult,
} from '../../lib/schema/ocrSchema'
import { GEMMA_LOCAL_MODEL_ID } from '../../lib/analysis/prompt'
import { selectAccommodationDraft } from '../../lib/text/accommodationDraftSelection'
import {
  ACCOMMODATION_EXTRACTION_SYSTEM_PROMPT,
  buildAccommodationExtractionPrompt,
  buildAccommodationFocusedExtractionPrompt,
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
} from '../../lib/text/accommodationImagePrep'
import type { UploadedAttachment } from '../../types/analysis'
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

type SourceKey = 'iep' | 'task'

const DOCUMENT_SYSTEM_PROMPT = [
  'You are a careful document-reading assistant for IEP Compass.',
  'Look at the image and interpret what kind of school document it appears to be.',
  'Extract exact visible wording when you can, but also organize it into a structured review draft.',
  'Never invent diagnosis wording, accommodations, assignment directions, or missing document details.',
  'If text is blurry or unreadable, preserve [unclear] instead of guessing.',
  'For IEP accommodation forms: group accommodations by the visible section labels on the page when possible.',
  'For assignment or quiz pages: describe the task, subject, work type, topic, timing, and whether it appears focused on calculation skill versus broader geometry or reasoning work.',
  'Use cautious inference for task traits. If something is not visible enough, leave it empty or mark it unknown.',
  'Return JSON only with one of these document kinds: iep_accommodations, assignment_or_quiz, unknown.',
  'Every reviewDraft must include sourceSummaryText as a normalized text summary for downstream mapping.',
].join('\n')

function formatModelLabel(model: string) {
  return model
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

function extractJson(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fencedMatch ? fencedMatch[1].trim() : content.trim()
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
    'For task pages, do not decide the final accommodation mapping here. Only summarize the task and its visible traits.',
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
        label: string
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
    throw new Error(`Gemma document reading request failed with ${response.status}.`)
  }

  const payload = (await response.json()) as OpenAICompatibleResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Gemma document reading did not return message content.')
  }

  return parseDocumentReadingResult(JSON.parse(extractJson(content)))
}

async function requestIepTextReading(options: {
  baseUrl: string
  headers: HeadersInit
  imageDataUrl: string
  instruction: string
  model: string
  temperature?: number
}) {
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
    throw new Error(`Gemma IEP text reading request failed with ${response.status}.`)
  }

  const payload = (await response.json()) as OpenAICompatibleResponse
  const content = payload.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Gemma IEP text reading did not return message content.')
  }

  return extractPlainText(content)
}

async function requestWithFallback(
  config: GemmaDocumentConfig,
  imageDataUrl: string,
  instruction: string,
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
      result,
      usedFallback: false,
    }
  } catch (primaryError) {
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
    label: string
  }>
  normalizedAsset?: AccommodationImagePrepAsset
  originalAsset?: AccommodationImagePrepAsset
  passes: Array<{
    imageDataUrl: string
    instruction: string
    label: string
  }>
  photoMode?: boolean
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
    imageDataUrl: string
    instruction: string
    label: string
  }) => {
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

  const firstPassResult = await runPass(firstPass)
  const draftHealth: AccommodationDraftHealth | undefined
    = assessAccommodationDraftHealth(firstPassResult)

  focusedRecoveryTriggered = shouldTriggerAccommodationFocusedRecovery(firstPassResult, {
    isPhotoMode: Boolean(options.photoMode),
  })

  if (focusedRecoveryTriggered && options.focusedRecoveryTiles?.length) {
    const tileDrafts: Array<{
      label: string
      text: string
    }> = []

    for (const tile of options.focusedRecoveryTiles) {
      try {
        const tileOutput = await runPass({
          imageDataUrl: tile.imageDataUrl,
          instruction: tile.instruction,
          label: `focused_recovery_tile_${tile.label}`,
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
      drafts.push(mergedTileDraft)
      passOutputs.push({
        label: 'focused_recovery_tiled',
        output: mergedTileDraft,
      })
    } else if (options.passes[1]) {
      try {
        await runPass(options.passes[1])
      } catch {
        focusedRecoveryTriggered = true
      }
    }
  } else if (focusedRecoveryTriggered && options.passes[1]) {
    try {
      await runPass(options.passes[1])
    } catch {
      focusedRecoveryTriggered = true
    }
  }

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
): Promise<GemmaDocumentReadingResult> {
  const config = readConfig()

  if (!config.baseUrl) {
    throw new Error('Gemma document reading is not configured yet for this session.')
  }

  if (attachment.kind !== 'image' && attachment.kind !== 'pdf') {
    throw new Error('Gemma document reading only supports images and PDFs in this phase.')
  }

  if (attachment.kind === 'image') {
    const imageDataUrl = await fileToDataUrl(attachment.file)
    const response = await requestWithFallback(
      config,
      imageDataUrl,
      buildDocumentReadingInstruction(attachment.name, attachment.kind, sourceKey),
    )

    return {
      documentResult: response.result,
      modelLabel: response.modelLabel,
      readMethod: 'gemma4_image',
      runtimeLabel: config.runtimeLabel,
      usedFallback: response.usedFallback,
    }
  }

  const pdfPages = await renderPdfPagesToImageDataUrls(attachment.file)
  const pageResults: DocumentReadingResult[] = []
  let modelLabel = formatModelLabel(config.primaryModel)
  let usedFallback = false

  for (let index = 0; index < pdfPages.imageDataUrls.length; index += 1) {
    const response = await requestWithFallback(
      config,
      pdfPages.imageDataUrls[index],
      buildDocumentReadingInstruction(
        attachment.name,
        attachment.kind,
        sourceKey,
        index + 1,
        pdfPages.processedPageCount,
      ),
    )

    pageResults.push(response.result)
    modelLabel = response.modelLabel
    usedFallback = usedFallback || response.usedFallback

    await new Promise((resolve) => {
      window.setTimeout(resolve, 0)
    })
  }

  const documentResult = mergeDocumentResults(pageResults)

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
): Promise<GemmaIepTextReadingResult> {
  const config = readConfig()

  if (!config.baseUrl) {
    throw new Error('Gemma document reading is not configured yet for this session.')
  }

  if (attachment.kind !== 'image' && attachment.kind !== 'pdf') {
    throw new Error('Gemma document reading only supports images and PDFs in this phase.')
  }

  if (attachment.kind === 'image') {
    const preparedImage = await prepareAccommodationImageForReading(attachment.file)
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
          {
            conditionFocus: tile.label === 'student_response_conditions',
            photoMode: preparedImage.photoMode,
          },
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
      photoMode: preparedImage.photoMode,
      preprocessRuntimeMs: preparedImage.preprocessRuntimeMs,
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

  const pdfPages = await renderPdfPagesToImageDataUrls(attachment.file)
  const pageTexts: string[] = []
  let modelLabel = formatModelLabel(config.primaryModel)
  let usedFallback = false

  for (let index = 0; index < pdfPages.imageDataUrls.length; index += 1) {
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

  return {
    extractedText: pageTexts.map((text) => text.trim()).filter(Boolean).join('\n\n'),
    modelLabel,
    pageCount: pdfPages.pageCount,
    processedPageCount: pdfPages.processedPageCount,
    readMethod: 'gemma4_pdf_pages',
    runtimeLabel: config.runtimeLabel,
    usedFallback,
  }
}
