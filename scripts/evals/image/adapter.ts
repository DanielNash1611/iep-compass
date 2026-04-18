import { execFile as execFileCallback } from 'node:child_process'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import {
  assignmentUploadInterpretationSchema,
  type AssignmentUploadInterpretation,
} from '../../../src/lib/schema/imageInterpretationSchema.ts'
import { selectAccommodationDraft } from '../../../src/lib/text/accommodationDraftSelection.ts'
import { ACCOMMODATION_EXTRACTION_SYSTEM_PROMPT } from '../../../src/lib/text/accommodationExtractionPrompt.ts'
import {
  ACCOMMODATION_PHOTO_LONG_SIDE,
  ACCOMMODATION_PHOTO_NODE_QUALITY,
  ACCOMMODATION_PHOTO_RECOVERY_CROP_RATIO,
  assessAccommodationDraftHealth,
  getAccommodationImagePrepDecision,
  getAccommodationPhotoRecoveryTileRects,
  mergeAccommodationPhotoRecoveryTileDrafts,
  shouldTriggerAccommodationFocusedRecovery,
} from '../../../src/lib/text/accommodationImagePrep.ts'
import type { ImageEvalConfig } from './config.ts'
import { classifyImageEvalFailure } from './failureMode.ts'
import {
  callOllamaNativeJson,
  callOllamaNativeText,
  callOpenAiCompatibleText,
  callOpenAiCompatibleJson,
} from './openaiCompatible.ts'
import {
  buildAccommodationImageFocusedPrompt,
  buildAccommodationImageManualFlowPrompt,
  buildAssignmentImageManualFlowPrompt,
  buildAssignmentImageStructuringPrompt,
} from './prompts.ts'
import type {
  ImageAssetDetails,
  ImageEvalDiagnostics,
  ModelInterpretationResult,
} from './types.ts'

const execFile = promisify(execFileCallback)

export interface VisionModelAdapter {
  interpretAccommodationUpload: (
    imagePath: string,
  ) => Promise<ModelInterpretationResult<string>>
  interpretAssignmentUpload: (
    imagePath: string,
  ) => Promise<ModelInterpretationResult<AssignmentUploadInterpretation>>
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function getMimeType(imagePath: string) {
  const extension = path.extname(imagePath).toLowerCase()
  return MIME_BY_EXTENSION[extension] || 'application/octet-stream'
}

function getFormat(imagePath: string) {
  const mimeType = getMimeType(imagePath)
  return mimeType.replace('image/', '')
}

function shouldUseOllamaNative(baseUrl: string) {
  return /127\.0\.0\.1:11434|localhost:11434/i.test(baseUrl)
}

function parseSipsDimension(stdout: string, key: 'pixelWidth' | 'pixelHeight') {
  const match = stdout.match(new RegExp(`${key}:\\s*(\\d+)`))

  if (!match) {
    throw new Error(`Could not read ${key} from sips output.`)
  }

  return Number(match[1])
}

async function inspectImageAsset(imagePath: string): Promise<ImageAssetDetails> {
  const fileStat = await stat(imagePath)
  const { stdout } = await execFile('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', imagePath])

  return {
    bytes: fileStat.size,
    dimensions: {
      height: parseSipsDimension(stdout, 'pixelHeight'),
      width: parseSipsDimension(stdout, 'pixelWidth'),
    },
    format: getFormat(imagePath),
    mimeType: getMimeType(imagePath),
    path: imagePath,
  }
}

type InterpretationTask = 'accommodation' | 'assignment'

async function preprocessImageForLocalOllama(
  imagePath: string,
  options: {
    preferOriginal?: boolean
  } = {},
): Promise<{ asset: ImageAssetDetails; preprocessRuntimeMs: number }> {
  const originalAsset = await inspectImageAsset(imagePath)
  const longSide = Math.max(
    originalAsset.dimensions.width,
    originalAsset.dimensions.height,
  )
  const preserveThresholdBytes = options.preferOriginal ? 2_000_000 : 750_000
  const preserveThresholdLongSide = options.preferOriginal ? 2_000 : 1_600
  const shouldNormalize =
    !['image/jpeg', 'image/png', 'image/webp'].includes(originalAsset.mimeType)
    || longSide > preserveThresholdLongSide
    || originalAsset.bytes > preserveThresholdBytes

  if (!shouldNormalize) {
    return {
      asset: originalAsset,
      preprocessRuntimeMs: 0,
    }
  }

  const startedAt = Date.now()
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'iep-compass-image-eval-'))
  const outputPath = path.join(tempDirectory, `${path.parse(imagePath).name}-ollama.jpg`)

  await execFile('sips', [
    '-Z',
    options.preferOriginal ? '2000' : '1280',
    '-s',
    'format',
    'jpeg',
    '-s',
    'formatOptions',
    options.preferOriginal ? '85' : '75',
    imagePath,
    '--out',
    outputPath,
  ])

  return {
    asset: await inspectImageAsset(outputPath),
    preprocessRuntimeMs: Date.now() - startedAt,
  }
}

async function preprocessAccommodationImageForComparison(imagePath: string) {
  const originalAsset = await inspectImageAsset(imagePath)
  const prepDecision = getAccommodationImagePrepDecision(originalAsset)

  if (!prepDecision.shouldNormalize) {
    return {
      asset: originalAsset,
      focusedRecoveryAsset: originalAsset,
      normalizedAsset: undefined,
      originalAsset,
      photoMode: prepDecision.isPhotoMode,
      preprocessRuntimeMs: 0,
    }
  }

  const startedAt = Date.now()
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'iep-compass-image-eval-'))
  const outputPath = path.join(tempDirectory, `${path.parse(imagePath).name}-comparison.jpg`)

  await execFile('sips', [
    '-Z',
    String(ACCOMMODATION_PHOTO_LONG_SIDE),
    '-s',
    'format',
    'jpeg',
    '-s',
    'formatOptions',
    String(ACCOMMODATION_PHOTO_NODE_QUALITY),
    imagePath,
    '--out',
    outputPath,
  ])

  const normalizedAsset = await inspectImageAsset(outputPath)
  let focusedRecoveryAsset = normalizedAsset
  let focusedRecoveryTiles:
    | Array<{
      asset: ImageAssetDetails
      label: string
    }>
    | undefined

  if (prepDecision.isPhotoMode) {
    const rotatedOutputPath = path.join(
      tempDirectory,
      `${path.parse(imagePath).name}-comparison-rotated.jpg`,
    )

    await execFile('sips', [
      '-r',
      '-90',
      outputPath,
      '--out',
      rotatedOutputPath,
    ])

    const rotatedAsset = await inspectImageAsset(rotatedOutputPath)
    const croppedOutputPath = path.join(
      tempDirectory,
      `${path.parse(imagePath).name}-comparison-rotated-cropped.jpg`,
    )
    const cropHeight = Math.max(
      1,
      Math.min(
        rotatedAsset.dimensions.height,
        Math.round(rotatedAsset.dimensions.height * ACCOMMODATION_PHOTO_RECOVERY_CROP_RATIO),
      ),
    )

    await execFile('sips', [
      '-c',
      String(cropHeight),
      String(rotatedAsset.dimensions.width),
      '--cropOffset',
      '0',
      '0',
      rotatedOutputPath,
      '--out',
      croppedOutputPath,
    ])

    focusedRecoveryAsset = await inspectImageAsset(croppedOutputPath)
    const tileRects = getAccommodationPhotoRecoveryTileRects(
      focusedRecoveryAsset.dimensions,
    )

    focusedRecoveryTiles = await Promise.all(tileRects.map(async (tileRect) => {
      const tileOutputPath = path.join(
        tempDirectory,
        `${path.parse(imagePath).name}-comparison-rotated-cropped-${tileRect.label}.jpg`,
      )

      await execFile('sips', [
        '-c',
        String(tileRect.height),
        String(tileRect.width),
        '--cropOffset',
        String(tileRect.y),
        String(tileRect.x),
        croppedOutputPath,
        '--out',
        tileOutputPath,
      ])

      return {
        asset: await inspectImageAsset(tileOutputPath),
        label: tileRect.label,
      }
    }))
  }

  return {
    asset: normalizedAsset,
    focusedRecoveryAsset,
    focusedRecoveryTiles,
    normalizedAsset,
    originalAsset,
    photoMode: prepDecision.isPhotoMode,
    preprocessRuntimeMs: Date.now() - startedAt,
  }
}

async function imagePathToDataUrl(imagePath: string) {
  const buffer = await readFile(imagePath)
  return `data:${getMimeType(imagePath)};base64,${buffer.toString('base64')}`
}

class GemmaVisionEvalAdapter implements VisionModelAdapter {
  private readonly config: ImageEvalConfig

  constructor(config: ImageEvalConfig) {
    this.config = config
  }

  async interpretAccommodationUpload(
    imagePath: string,
  ): Promise<ModelInterpretationResult<string>> {
    return this.interpretAccommodationText(imagePath)
  }

  async interpretAssignmentUpload(
    imagePath: string,
  ): Promise<ModelInterpretationResult<AssignmentUploadInterpretation>> {
    return this.interpretImage({
      imagePath,
      task: 'assignment',
      schema: assignmentUploadInterpretationSchema,
    })
  }

  private async interpretImage<TOutput>(options: {
    imagePath: string
    task: InterpretationTask
    schema: {
      safeParse: (input: unknown) =>
        | { data: TOutput; success: true }
        | { error: { issues: Array<{ message: string; path: Array<string | number> }> }; success: false }
    }
  }): Promise<ModelInterpretationResult<TOutput>> {
    const startedAt = Date.now()
    const useOllamaNative = shouldUseOllamaNative(this.config.baseUrl)
    const manualPrompt =
      options.task === 'accommodation'
        ? buildAccommodationImageManualFlowPrompt(
            this.config.model === 'gemma4:e2b' ? 'app' : 'eval',
          )
        : buildAssignmentImageManualFlowPrompt()
    const buildStructuringPrompt =
      options.task === 'accommodation'
        ? buildAccommodationImageStructuringPrompt
        : buildAssignmentImageStructuringPrompt
    const diagnostics: ImageEvalDiagnostics = {
      pipeline: 'vision_extract_then_structure',
      failurePoint: 'inspect_original',
      inactivityTimeoutMs: this.config.inactivityTimeoutMs,
      requestPath: useOllamaNative
        ? '/api/chat (ollama sdk)'
        : '/v1/chat/completions',
      totalTimeoutMs: this.config.timeoutMs,
      transport: useOllamaNative
        ? 'ollama_sdk'
        : 'openai_compatible',
    }

    try {
      diagnostics.originalAsset = await inspectImageAsset(options.imagePath)
      diagnostics.failurePoint = 'preprocess'

      const preparedAsset = useOllamaNative
        ? await preprocessImageForLocalOllama(options.imagePath)
        : {
            asset: diagnostics.originalAsset,
            preprocessRuntimeMs: 0,
          }

      diagnostics.finalAsset = preparedAsset.asset
      diagnostics.preprocessRuntimeMs = preparedAsset.preprocessRuntimeMs
      diagnostics.failurePoint = 'manual_extraction'

      const extractionResponse = useOllamaNative
        ? await callOllamaNativeText({
            baseUrl: this.config.baseUrl,
            imagePath: preparedAsset.asset.path,
            inactivityTimeoutMs: this.config.inactivityTimeoutMs,
            model: this.config.model,
            prompt: manualPrompt,
            timeoutMs: this.config.timeoutMs,
          })
        : await callOpenAiCompatibleText({
            apiKey: this.config.apiKey,
            baseUrl: this.config.baseUrl,
            messages: [
              {
                content: [
                  {
                    text: manualPrompt,
                    type: 'text',
                  },
                  {
                    image_url: {
                      url: await imagePathToDataUrl(preparedAsset.asset.path),
                    },
                    type: 'image_url',
                  },
                ],
                role: 'user',
              },
            ],
            model: this.config.model,
            temperature: 0,
            timeoutMs: this.config.timeoutMs,
          })

      diagnostics.extractionPreview = extractionResponse.rawContent.slice(0, 500)
      diagnostics.extractionRuntimeMs =
        'runtimeMs' in extractionResponse ? extractionResponse.runtimeMs : undefined
      diagnostics.firstChunkMs =
        'firstChunkMs' in extractionResponse ? extractionResponse.firstChunkMs : undefined
      diagnostics.firstContentMs =
        'firstContentMs' in extractionResponse ? extractionResponse.firstContentMs : undefined
      diagnostics.failurePoint = 'structure_json'

      const structuringPrompt = buildStructuringPrompt(extractionResponse.rawContent)
      const structuringResponse = useOllamaNative
        ? await callOllamaNativeJson({
            baseUrl: this.config.baseUrl,
            inactivityTimeoutMs: this.config.inactivityTimeoutMs,
            model: this.config.model,
            prompt: structuringPrompt,
            temperature: 0,
            timeoutMs: this.config.timeoutMs,
          })
        : await callOpenAiCompatibleJson({
            apiKey: this.config.apiKey,
            baseUrl: this.config.baseUrl,
            messages: [
              {
                content: 'Return JSON only.',
                role: 'system',
              },
              {
                content: structuringPrompt,
                role: 'user',
              },
            ],
            model: this.config.model,
            temperature: 0,
            timeoutMs: this.config.timeoutMs,
          })

      diagnostics.structuringRuntimeMs =
        'runtimeMs' in structuringResponse ? structuringResponse.runtimeMs : undefined
      diagnostics.failurePoint = 'response_parse'

      try {
        const rawJson = JSON.parse(structuringResponse.extractedJson)
        const parsed = options.schema.safeParse(rawJson)

        if (!parsed.success) {
          diagnostics.failurePoint = 'schema_parse'
          diagnostics.runtimeMs = Date.now() - startedAt

          return {
            diagnostics,
            parseError: parsed.error.issues
              .map((issue) =>
                `${issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''}${issue.message}`,
              )
              .join('; '),
            rawContent: structuringResponse.rawContent,
            rawJson,
          }
        }

        diagnostics.failurePoint = undefined
        diagnostics.runtimeMs = Date.now() - startedAt

        return {
          diagnostics,
          output: parsed.data,
          rawContent: structuringResponse.rawContent,
          rawJson,
        }
      } catch (error) {
        diagnostics.failurePoint = 'json_parse'
        diagnostics.runtimeMs = Date.now() - startedAt

        return {
          diagnostics,
          parseError: error instanceof Error ? error.message : String(error),
          rawContent: structuringResponse.rawContent,
        }
      }
    } catch (error) {
      diagnostics.runtimeMs = Date.now() - startedAt

      return {
        diagnostics,
        parseError: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async interpretAccommodationText(
    imagePath: string,
  ): Promise<ModelInterpretationResult<string>> {
    const startedAt = Date.now()
    const useAppProfile = this.config.model === 'gemma4:e2b'
    const useOllamaNative = !useAppProfile && shouldUseOllamaNative(this.config.baseUrl)
    const diagnostics: ImageEvalDiagnostics = {
      attempts: [],
      pipeline: 'vision_extract_text',
      failurePoint: 'inspect_original',
      inactivityTimeoutMs: this.config.inactivityTimeoutMs,
      requestPath: useOllamaNative
        ? '/api/chat (ollama sdk)'
        : '/v1/chat/completions',
      totalTimeoutMs: this.config.timeoutMs,
      transport: useOllamaNative
        ? 'ollama_sdk'
        : 'openai_compatible',
    }

    try {
      diagnostics.originalAsset = await inspectImageAsset(imagePath)
      diagnostics.failurePoint = 'preprocess'

      const preparedAsset = useAppProfile
        ? await preprocessAccommodationImageForComparison(imagePath)
        : useOllamaNative
        ? await preprocessImageForLocalOllama(imagePath, {
            preferOriginal: false,
          })
        : {
            asset: diagnostics.originalAsset,
            preprocessRuntimeMs: 0,
          }

      diagnostics.finalAsset = preparedAsset.asset
      diagnostics.focusedRecoveryTriggered = false
      diagnostics.normalizedAsset = 'normalizedAsset' in preparedAsset
        ? preparedAsset.normalizedAsset
        : undefined
      diagnostics.photoMode = 'photoMode' in preparedAsset
        ? preparedAsset.photoMode
        : false
      diagnostics.preprocessRuntimeMs = preparedAsset.preprocessRuntimeMs
      diagnostics.failurePoint = 'manual_extraction'
      const drafts: string[] = []
      const passResults: Array<{
        firstChunkMs?: number
        firstContentMs?: number
        output: string
        passLabel: string
        runtimeMs: number
      }> = []
      const normalizedImageDataUrl = useOllamaNative
        ? undefined
        : await imagePathToDataUrl(preparedAsset.asset.path)
      const focusedRecoveryImageDataUrl = useOllamaNative
        ? undefined
        : 'focusedRecoveryAsset' in preparedAsset
        ? await imagePathToDataUrl(preparedAsset.focusedRecoveryAsset.path)
        : normalizedImageDataUrl
      const focusedRecoveryTileDataUrls = useOllamaNative
        ? []
        : 'focusedRecoveryTiles' in preparedAsset && preparedAsset.focusedRecoveryTiles
        ? await Promise.all(
            preparedAsset.focusedRecoveryTiles.map(async (tile) => ({
              imageDataUrl: await imagePathToDataUrl(tile.asset.path),
              label: tile.label,
              path: tile.asset.path,
            })),
          )
        : []
      const originalImageDataUrl = useOllamaNative
        ? undefined
        : await imagePathToDataUrl(imagePath)
      const runAccommodationPass = async (imagePass: {
        imagePath: string
        imageDataUrl?: string
        label: string
        prompt: string
        timeoutMs?: number
      }) => {
        try {
          const extractionResponse = useOllamaNative
            ? await callOllamaNativeText({
                baseUrl: this.config.baseUrl,
                imagePath: imagePass.imagePath,
                inactivityTimeoutMs: this.config.inactivityTimeoutMs,
                model: this.config.model,
                prompt: imagePass.prompt,
                temperature: 0,
                timeoutMs: imagePass.timeoutMs ?? this.config.timeoutMs,
              })
            : await callOpenAiCompatibleText({
                apiKey: this.config.apiKey,
                baseUrl: this.config.baseUrl,
                messages: [
                  {
                    content: ACCOMMODATION_EXTRACTION_SYSTEM_PROMPT,
                    role: 'system',
                  },
                  {
                    content: [
                      {
                        text: imagePass.prompt,
                        type: 'text',
                      },
                      {
                        image_url: {
                          url: imagePass.imageDataUrl!,
                        },
                        type: 'image_url',
                      },
                    ],
                    role: 'user',
                  },
                ],
                model: this.config.model,
                temperature: 0,
                timeoutMs: imagePass.timeoutMs ?? this.config.timeoutMs,
              })

          const output = extractionResponse.rawContent.trim()
          drafts.push(output)
          passResults.push({
            firstChunkMs:
              'firstChunkMs' in extractionResponse ? extractionResponse.firstChunkMs : undefined,
            firstContentMs:
              'firstContentMs' in extractionResponse ? extractionResponse.firstContentMs : undefined,
            output,
            passLabel: imagePass.label,
            runtimeMs: 'runtimeMs' in extractionResponse ? extractionResponse.runtimeMs : 0,
          })
          diagnostics.attempts?.push({
            failureMode: 'none',
            firstChunkMs:
              'firstChunkMs' in extractionResponse ? extractionResponse.firstChunkMs : undefined,
            firstContentMs:
              'firstContentMs' in extractionResponse ? extractionResponse.firstContentMs : undefined,
            outputPreview: output.slice(0, 240),
            passLabel: imagePass.label,
            runtimeMs: 'runtimeMs' in extractionResponse ? extractionResponse.runtimeMs : 0,
          })
          return output
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          diagnostics.attempts?.push({
            error: message,
            failureMode: classifyImageEvalFailure(message),
            outputPreview: undefined,
            passLabel: imagePass.label,
          })
          throw error
        }
      }

      const firstPassOutput = await runAccommodationPass({
        imageDataUrl: originalImageDataUrl,
        imagePath,
        label: 'full',
        prompt: buildAccommodationImageManualFlowPrompt(
          useAppProfile ? 'app' : 'eval',
          {
            photoMode: Boolean(diagnostics.photoMode),
          },
        ),
      })

      if (useAppProfile) {
        diagnostics.draftHealth = assessAccommodationDraftHealth(firstPassOutput)
        diagnostics.focusedRecoveryTriggered = shouldTriggerAccommodationFocusedRecovery(
          firstPassOutput,
          {
            isPhotoMode: Boolean(diagnostics.photoMode),
          },
        )
      }

      if (useAppProfile && diagnostics.focusedRecoveryTriggered) {
        let hasMergedTileDraft = false

        if (diagnostics.photoMode && focusedRecoveryTileDataUrls.length > 0) {
          const tileDrafts: Array<{
            label: string
            text: string
          }> = []
          let mergedTileRuntimeMs = 0

          for (const tile of focusedRecoveryTileDataUrls) {
            try {
              const tileOutput = await runAccommodationPass({
                imageDataUrl: tile.imageDataUrl,
                imagePath: tile.path,
                label: `focused_recovery_tile_${tile.label}`,
                prompt: buildAccommodationImageFocusedPrompt({
                  conditionFocus: tile.label === 'student_response_conditions',
                  photoMode: false,
                }),
                timeoutMs: Math.min(this.config.timeoutMs, 30_000),
              })

              tileDrafts.push({
                label: tile.label,
                text: tileOutput,
              })
              mergedTileRuntimeMs +=
                passResults[passResults.length - 1]?.runtimeMs || 0
              drafts.pop()
              passResults.pop()
            } catch {
              continue
            }
          }

          const mergedTileDraft = mergeAccommodationPhotoRecoveryTileDrafts(tileDrafts)

          if (mergedTileDraft) {
            drafts.push(mergedTileDraft)
            passResults.push({
              output: mergedTileDraft,
              passLabel: 'focused_recovery_tiled',
              runtimeMs: mergedTileRuntimeMs,
            })
            hasMergedTileDraft = true
          }
        }

        if (!hasMergedTileDraft) {
          try {
            const recoveryPrompt = diagnostics.photoMode
              ? buildAccommodationImageManualFlowPrompt('app', {
                  photoMode: true,
                })
              : buildAccommodationImageFocusedPrompt({
                  photoMode: diagnostics.photoMode,
                })

            await runAccommodationPass({
              imageDataUrl: focusedRecoveryImageDataUrl || normalizedImageDataUrl || originalImageDataUrl,
              imagePath:
                'focusedRecoveryAsset' in preparedAsset
                  ? preparedAsset.focusedRecoveryAsset.path
                  : preparedAsset.asset.path,
              label: 'focused_recovery',
              prompt: recoveryPrompt,
              timeoutMs: Math.min(this.config.timeoutMs, 45_000),
            })
          } catch {
            diagnostics.focusedRecoveryTriggered = true
          }
        }
      }

      if (passResults.length === 0) {
        throw new Error('No accommodation extraction attempts succeeded.')
      }

      const finalOutput = useAppProfile ? selectAccommodationDraft(drafts) : passResults[0].output
      const selectedAttempt = passResults.find((result) => result.output === finalOutput) || passResults[0]
      diagnostics.selectedPassLabel = selectedAttempt.passLabel

      if (useAppProfile && diagnostics.originalAsset) {
        diagnostics.finalAsset =
          selectedAttempt.passLabel.startsWith('focused_recovery')
            && 'focusedRecoveryAsset' in preparedAsset
            && preparedAsset.focusedRecoveryAsset
            ? preparedAsset.focusedRecoveryAsset
            : selectedAttempt.passLabel.startsWith('focused_recovery') && diagnostics.normalizedAsset
            ? diagnostics.normalizedAsset
            : diagnostics.originalAsset
      }

      diagnostics.extractionPreview = finalOutput.slice(0, 500)
      diagnostics.extractionRuntimeMs =
        passResults.reduce((total, result) => total + result.runtimeMs, 0) || undefined
      diagnostics.firstChunkMs = selectedAttempt.firstChunkMs
      diagnostics.firstContentMs = selectedAttempt.firstContentMs
      diagnostics.failurePoint = undefined
      diagnostics.runtimeMs = Date.now() - startedAt

      return {
        diagnostics,
        output: finalOutput,
        rawContent: finalOutput,
        rawJson: undefined,
      }
    } catch (error) {
      diagnostics.runtimeMs = Date.now() - startedAt

      return {
        diagnostics,
        parseError: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

export function createGemmaVisionEvalAdapter(config: ImageEvalConfig): VisionModelAdapter {
  return new GemmaVisionEvalAdapter(config)
}
