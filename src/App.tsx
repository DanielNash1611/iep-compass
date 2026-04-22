import { useEffect, useRef, useState } from 'react'
import './App.css'
import { AppIcon, type AppIconName } from './components/AppIcon'
import { LoadingIndicator } from './components/LoadingIndicator'
import { SectionCard } from './components/SectionCard'
import BrowserGemmaApp from './features/on-device/BrowserGemmaApp'
import { exampleScenarios } from './data/examples'
import { TaskSetupFields } from './features/input/TaskSetupFields'
import { ResultsView } from './features/results/ResultsView'
import { SourceEditor } from './features/source/SourceEditor'
import {
  clearPersistedIepSource,
  hasPersistedIepSource,
  loadPersistedIepSource,
  persistIepSource,
} from './features/source/localSourceStorage'
import { SourceReviewPanel } from './features/source/SourceReviewPanel'
import {
  buildEffectiveSourceText,
  getAttachmentSourceText,
  getPrimaryTaskTraits,
  hasUsableSourceText,
  mergeSourceTextBlock,
  normalizeDocumentDraft,
} from './features/source/sourceText'
import {
  readGemmaDocumentPlan,
  runGemmaDocumentReading,
  runGemmaIepTextReading,
} from './features/upload/gemmaOcr'
import {
  createUploadedAttachment,
  loadLocalTextAttachment,
  refreshAttachmentNotes,
  revokeAttachmentPreview,
} from './features/upload/fileUtils'
import { createAnalysisAdapter } from './lib/analysis'
import { hasUncertaintyMarkers } from './lib/text/uncertaintyMarkers'
import type {
  AnalysisExecution,
  SourceMaterial,
  TaskReviewDraft,
  TaskContext,
  TeacherConcernExecution,
  TeacherConcernRequest,
  UploadedAttachment,
} from './types/analysis'

type Screen = 'iep' | 'assignment' | 'results'
type CorrectionTarget = 'iep' | 'assignment' | null
type SourceKey = 'iep' | 'task'

const HERO_GUIDEPOINTS: Array<{ icon: AppIconName; text: string }> = [
  { icon: 'notebook', text: 'Paste only the approved accommodation wording you want to rely on.' },
  { icon: 'assignment', text: 'Add the task or worksheet details next, not the answer.' },
  { icon: 'results', text: 'Get a quick map of what may apply, what to say, and what to confirm.' },
]

const STEP_CONFIG: Array<{
  helper: string
  icon: AppIconName
  id: Screen
  label: string
}> = [
  {
    id: 'iep',
    label: 'Review accommodations',
    helper: 'Approved IEP wording',
    icon: 'compass',
  },
  {
    id: 'assignment',
    label: 'Add task',
    helper: 'Assignment or quiz details',
    icon: 'assignment',
  },
  {
    id: 'results',
    label: 'Check next steps',
    helper: 'What may apply here',
    icon: 'results',
  },
]

const TRUST_BOUNDARIES: Array<{
  detail: string
  icon: AppIconName
  title: string
}> = [
  {
    icon: 'shield',
    title: 'Approved accommodations only',
    detail: 'We only point to accommodations that appear in the reviewed source materials you provide.',
  },
  {
    icon: 'waypoint',
    title: 'Accommodations, not answer-giving',
    detail: 'IEP Compass checks access accommodations. It does not do the classwork itself.',
  },
  {
    icon: 'source',
    title: 'Stays local in this session',
    detail: 'Uploads stay local during the session so families can review materials before sharing anything else.',
  },
]

const TEACHER_CONCERN_VERDICT_LABELS: Record<
  TeacherConcernExecution['result']['verdict'],
  string
> = {
  mixed_needs_context: 'Needs more context',
  supports_accommodation: 'Leans toward the accommodation',
  supports_teacher_concern: 'Leans toward the concern',
}

function createBlankSource(): SourceMaterial {
  return {
    attachments: [],
    text: '',
  }
}

function getRestoredIepSource() {
  return loadPersistedIepSource() ?? createBlankSource()
}

function copySource(source: SourceMaterial): SourceMaterial {
  return {
    attachments: [...source.attachments],
    text: source.text,
  }
}

function revokeRemovedAttachments(
  previousAttachments: UploadedAttachment[],
  nextAttachments: UploadedAttachment[],
) {
  const nextIds = new Set(nextAttachments.map((attachment) => attachment.id))

  previousAttachments
    .filter((attachment) => !nextIds.has(attachment.id))
    .forEach(revokeAttachmentPreview)
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'We hit a snag building the guidance. Review the details and try again.'
}

function getAnalysisSource(source: SourceMaterial): SourceMaterial {
  return {
    attachments: source.attachments,
    text: buildEffectiveSourceText(source),
  }
}

function getAnalysisTaskTraits(source: SourceMaterial): TaskReviewDraft | null {
  return getPrimaryTaskTraits(source)
}

function scrollToTop() {
  document.scrollingElement?.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth',
  })
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth',
  })
}

export default function App() {
  const [analysisAdapter] = useState(() => createAnalysisAdapter())
  const [screen, setScreen] = useState<Screen>('iep')
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null)
  const [contextTags, setContextTags] = useState<TaskContext[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [learningProfile, setLearningProfile] = useState('')
  const [teacherConcern, setTeacherConcern] = useState('')
  const [hasSavedIepOnDevice, setHasSavedIepOnDevice] = useState(() =>
    hasPersistedIepSource(),
  )
  const [shouldPersistIepSource, setShouldPersistIepSource] = useState(true)
  const [iepSource, setIepSource] = useState<SourceMaterial>(getRestoredIepSource)
  const [taskSource, setTaskSource] = useState<SourceMaterial>(createBlankSource)
  const [analysis, setAnalysis] = useState<AnalysisExecution | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [teacherConcernAnalysis, setTeacherConcernAnalysis] =
    useState<TeacherConcernExecution | null>(null)
  const [teacherConcernError, setTeacherConcernError] = useState<string | null>(
    null,
  )
  const [isTeacherConcernAnalyzing, setIsTeacherConcernAnalyzing] =
    useState(false)
  const [correctionTarget, setCorrectionTarget] =
    useState<CorrectionTarget>(null)
  const [correctionIepSource, setCorrectionIepSource] =
    useState<SourceMaterial>(createBlankSource)
  const [correctionTaskSource, setCorrectionTaskSource] =
    useState<SourceMaterial>(createBlankSource)
  const [correctionTaskTitle, setCorrectionTaskTitle] = useState('')
  const [correctionTeacherConcern, setCorrectionTeacherConcern] = useState('')
  const [correctionContextTags, setCorrectionContextTags] = useState<
    TaskContext[]
  >([])
  const latestSourcesRef = useRef<SourceMaterial[]>([])
  const analysisRunIdRef = useRef(0)
  const teacherConcernRunIdRef = useRef(0)

  const modelPlan = analysisAdapter.getModelPlan()
  const documentPlan = readGemmaDocumentPlan()

  function clearTeacherConcernState() {
    teacherConcernRunIdRef.current += 1
    setTeacherConcernAnalysis(null)
    setTeacherConcernError(null)
    setIsTeacherConcernAnalyzing(false)
  }

  function cancelPendingAnalysis() {
    analysisRunIdRef.current += 1
    setIsAnalyzing(false)
    clearTeacherConcernState()
  }

  function updateMainTeacherConcern(nextValue: string) {
    setTeacherConcern(nextValue)
    clearTeacherConcernState()
  }

  function replaceIepSource(
    nextSource: SourceMaterial,
    options: { persist?: boolean } = {},
  ) {
    const { persist = true } = options
    setShouldPersistIepSource(persist)
    setIepSource((current) => {
      revokeRemovedAttachments(current.attachments, nextSource.attachments)
      return nextSource
    })
  }

  function replaceTaskSource(nextSource: SourceMaterial) {
    setTaskSource((current) => {
      revokeRemovedAttachments(current.attachments, nextSource.attachments)
      return nextSource
    })
  }

  function syncCorrectionDrafts(nextTarget: CorrectionTarget) {
    setCorrectionIepSource((current) => {
      revokeRemovedAttachments(current.attachments, iepSource.attachments)
      return copySource(iepSource)
    })

    setCorrectionTaskSource((current) => {
      revokeRemovedAttachments(current.attachments, taskSource.attachments)
      return copySource(taskSource)
    })

    setCorrectionTaskTitle(taskTitle)
    setCorrectionTeacherConcern(teacherConcern)
    setCorrectionContextTags(contextTags)
    setCorrectionTarget(nextTarget)
  }

  useEffect(() => {
    latestSourcesRef.current = [
      iepSource,
      taskSource,
      correctionIepSource,
      correctionTaskSource,
    ]
  }, [correctionIepSource, correctionTaskSource, iepSource, taskSource])

  useEffect(() => {
    if (!shouldPersistIepSource) {
      // Example scenarios stay ephemeral so a sample never overwrites saved family data.
      return
    }

    setHasSavedIepOnDevice(persistIepSource(iepSource))
  }, [iepSource, shouldPersistIepSource])

  useEffect(() => {
    return () => {
      latestSourcesRef.current
        .flatMap((source) => source.attachments)
        .forEach(revokeAttachmentPreview)
    }
  }, [])

  useEffect(() => {
    scrollToTop()
  }, [screen])

  function markMainSourceChanged() {
    setActiveExampleId(null)
    setAnalysisError(null)
    clearTeacherConcernState()
  }

  function updateMainIepText(nextValue: string) {
    setShouldPersistIepSource(true)
    setIepSource((current) => ({ ...current, text: nextValue }))
    markMainSourceChanged()
  }

  function updateAttachmentList(
    attachments: UploadedAttachment[],
    attachmentId: string,
    updater: (attachment: UploadedAttachment) => UploadedAttachment,
  ) {
    return attachments.map((attachment) =>
      attachment.id === attachmentId ? updater(attachment) : attachment,
    )
  }

  function updateMainSource(
    sourceKey: SourceKey,
    updater: (current: SourceMaterial) => SourceMaterial,
  ) {
    if (sourceKey === 'iep') {
      setShouldPersistIepSource(true)
      setIepSource(updater)
      return
    }

    setTaskSource(updater)
  }

  function updateCorrectionSource(
    sourceKey: SourceKey,
    updater: (current: SourceMaterial) => SourceMaterial,
  ) {
    if (sourceKey === 'iep') {
      setCorrectionIepSource(updater)
      return
    }

    setCorrectionTaskSource(updater)
  }

  function patchMainAttachment(
    sourceKey: SourceKey,
    attachmentId: string,
    updater: (attachment: UploadedAttachment) => UploadedAttachment,
    shouldReset = true,
  ) {
    updateMainSource(sourceKey, (current) => ({
      ...current,
      attachments: updateAttachmentList(current.attachments, attachmentId, updater),
    }))

    if (shouldReset) {
      markMainSourceChanged()
    }
  }

  function patchCorrectionAttachment(
    sourceKey: SourceKey,
    attachmentId: string,
    updater: (attachment: UploadedAttachment) => UploadedAttachment,
  ) {
    updateCorrectionSource(sourceKey, (current) => ({
      ...current,
      attachments: updateAttachmentList(current.attachments, attachmentId, updater),
    }))
  }

  async function appendFilesToMainSource(sourceKey: SourceKey, files: File[]) {
    const nextAttachments = files.map((file) => createUploadedAttachment(file))

    updateMainSource(sourceKey, (current) => ({
      ...current,
      attachments: [...current.attachments, ...nextAttachments],
    }))
    markMainSourceChanged()

    await Promise.all(
      nextAttachments
        .filter((attachment) => attachment.kind === 'text')
        .map(async (attachment) => {
          const loadedAttachment = await loadLocalTextAttachment(attachment)

          patchMainAttachment(
            sourceKey,
            attachment.id,
            () => loadedAttachment,
            false,
          )
        }),
    )
  }

  async function appendFilesToCorrectionSource(
    sourceKey: SourceKey,
    files: File[],
  ) {
    const nextAttachments = files.map((file) => createUploadedAttachment(file))

    updateCorrectionSource(sourceKey, (current) => ({
      ...current,
      attachments: [...current.attachments, ...nextAttachments],
    }))

    await Promise.all(
      nextAttachments
        .filter((attachment) => attachment.kind === 'text')
        .map(async (attachment) => {
          const loadedAttachment = await loadLocalTextAttachment(attachment)

          patchCorrectionAttachment(sourceKey, attachment.id, () => loadedAttachment)
        }),
    )
  }

  async function runMainAttachmentInterpretation(
    sourceKey: SourceKey,
    attachmentId: string,
  ) {
    const source = sourceKey === 'iep' ? iepSource : taskSource
    const attachment = source.attachments.find(
      (candidate) => candidate.id === attachmentId,
    )

    if (!attachment) {
      return
    }

    patchMainAttachment(sourceKey, attachmentId, (current) =>
      refreshAttachmentNotes({
        ...current,
        readError: undefined,
        readNotes: [],
        status: 'interpret_running',
      }),
    )

    try {
      if (sourceKey === 'iep') {
        const readingResult = await runGemmaIepTextReading(attachment)

        patchMainAttachment(
          sourceKey,
          attachmentId,
          (current) =>
            refreshAttachmentNotes({
              ...current,
              confidenceFlags: undefined,
              documentDraft: undefined,
              documentKind: 'iep_accommodations',
              extractedText: readingResult.extractedText,
              rawTranscript: undefined,
              readContainsUnclearText: hasUncertaintyMarkers(readingResult.extractedText),
              readError: undefined,
              readMethod: readingResult.readMethod,
              readNotes: [
                `Interpreted with ${readingResult.modelLabel} via ${readingResult.runtimeLabel}.`,
                'Review this extracted accommodations text before adding it to the source trail.',
              ],
              pageCount: readingResult.pageCount,
              processedPageCount: readingResult.processedPageCount,
              reviewedText: undefined,
              status: 'review_ready',
            }),
          false,
        )

        return
      }

      const readingResult = await runGemmaDocumentReading(attachment, sourceKey)

      patchMainAttachment(
        sourceKey,
        attachmentId,
        (current) =>
          refreshAttachmentNotes({
            ...current,
            confidenceFlags: readingResult.documentResult.confidenceFlags,
            documentDraft: normalizeDocumentDraft(
              readingResult.documentResult.reviewDraft,
            ),
            documentKind: readingResult.documentResult.documentKind,
            rawTranscript: readingResult.documentResult.rawTranscript,
            readContainsUnclearText:
              readingResult.documentResult.confidenceFlags.containsUnclearText,
            readError: undefined,
            readMethod: readingResult.readMethod,
            readNotes: [
              `Interpreted with ${readingResult.modelLabel} via ${readingResult.runtimeLabel}.`,
              ...readingResult.documentResult.notes,
            ],
            pageCount: readingResult.pageCount,
            processedPageCount: readingResult.processedPageCount,
            reviewedText: undefined,
            status: 'review_ready',
          }),
        false,
      )
    } catch (error) {
      patchMainAttachment(
        sourceKey,
        attachmentId,
        (current) =>
          refreshAttachmentNotes({
            ...current,
            readError:
              error instanceof Error
                ? error.message
                : 'We could not interpret enough of this file clearly.',
            reviewedText: undefined,
            status: 'failed',
          }),
        false,
      )
    }
  }

  async function runCorrectionAttachmentInterpretation(
    sourceKey: SourceKey,
    attachmentId: string,
  ) {
    const source = sourceKey === 'iep' ? correctionIepSource : correctionTaskSource
    const attachment = source.attachments.find(
      (candidate) => candidate.id === attachmentId,
    )

    if (!attachment) {
      return
    }

    patchCorrectionAttachment(sourceKey, attachmentId, (current) =>
      refreshAttachmentNotes({
        ...current,
        readError: undefined,
        readNotes: [],
        status: 'interpret_running',
      }),
    )

    try {
      if (sourceKey === 'iep') {
        const readingResult = await runGemmaIepTextReading(attachment)

        patchCorrectionAttachment(sourceKey, attachmentId, (current) =>
          refreshAttachmentNotes({
            ...current,
            confidenceFlags: undefined,
            documentDraft: undefined,
            documentKind: 'iep_accommodations',
            extractedText: readingResult.extractedText,
            rawTranscript: undefined,
            readContainsUnclearText: hasUncertaintyMarkers(readingResult.extractedText),
            readError: undefined,
            readMethod: readingResult.readMethod,
            readNotes: [
              `Interpreted with ${readingResult.modelLabel} via ${readingResult.runtimeLabel}.`,
              'Review this extracted accommodations text before adding it to the source trail.',
            ],
            pageCount: readingResult.pageCount,
            processedPageCount: readingResult.processedPageCount,
            reviewedText: undefined,
            status: 'review_ready',
          }),
        )

        return
      }

      const readingResult = await runGemmaDocumentReading(attachment, sourceKey)

      patchCorrectionAttachment(sourceKey, attachmentId, (current) =>
        refreshAttachmentNotes({
          ...current,
          confidenceFlags: readingResult.documentResult.confidenceFlags,
          documentDraft: normalizeDocumentDraft(
            readingResult.documentResult.reviewDraft,
          ),
          documentKind: readingResult.documentResult.documentKind,
          rawTranscript: readingResult.documentResult.rawTranscript,
          readContainsUnclearText:
            readingResult.documentResult.confidenceFlags.containsUnclearText,
          readError: undefined,
          readMethod: readingResult.readMethod,
          readNotes: [
            `Interpreted with ${readingResult.modelLabel} via ${readingResult.runtimeLabel}.`,
            ...readingResult.documentResult.notes,
          ],
          pageCount: readingResult.pageCount,
          processedPageCount: readingResult.processedPageCount,
          reviewedText: undefined,
          status: 'review_ready',
        }),
      )
    } catch (error) {
      patchCorrectionAttachment(sourceKey, attachmentId, (current) =>
        refreshAttachmentNotes({
          ...current,
          readError:
            error instanceof Error
              ? error.message
              : 'We could not interpret enough of this file clearly.',
          reviewedText: undefined,
          status: 'failed',
        }),
      )
    }
  }

  function updateMainAttachmentTextDraft(
    sourceKey: SourceKey,
    attachmentId: string,
    nextValue: string,
  ) {
    patchMainAttachment(sourceKey, attachmentId, (attachment) =>
      refreshAttachmentNotes({
        ...attachment,
        extractedText:
          attachment.status === 'included' ? attachment.extractedText : nextValue,
        reviewedText:
          attachment.status === 'included' ? nextValue : attachment.reviewedText,
      }),
    )
  }

  function updateCorrectionAttachmentTextDraft(
    sourceKey: SourceKey,
    attachmentId: string,
    nextValue: string,
  ) {
    patchCorrectionAttachment(sourceKey, attachmentId, (attachment) =>
      refreshAttachmentNotes({
        ...attachment,
        extractedText:
          attachment.status === 'included' ? attachment.extractedText : nextValue,
        reviewedText:
          attachment.status === 'included' ? nextValue : attachment.reviewedText,
      }),
    )
  }

  function updateMainAttachmentDocumentDraft(
    sourceKey: SourceKey,
    attachmentId: string,
    nextDraft: UploadedAttachment['documentDraft'],
  ) {
    patchMainAttachment(sourceKey, attachmentId, (attachment) =>
      refreshAttachmentNotes({
        ...attachment,
        documentDraft: normalizeDocumentDraft(nextDraft),
      }),
    )
  }

  function updateCorrectionAttachmentDocumentDraft(
    sourceKey: SourceKey,
    attachmentId: string,
    nextDraft: UploadedAttachment['documentDraft'],
  ) {
    patchCorrectionAttachment(sourceKey, attachmentId, (attachment) =>
      refreshAttachmentNotes({
        ...attachment,
        documentDraft: normalizeDocumentDraft(nextDraft),
      }),
    )
  }

  function includeMainAttachmentSource(sourceKey: SourceKey, attachmentId: string) {
    let includedSourceText = ''

    patchMainAttachment(sourceKey, attachmentId, (attachment) => {
      const reviewedText =
        (attachment.reviewedText ?? attachment.extractedText ?? '').trim()
          ? attachment.reviewedText ?? attachment.extractedText
          : undefined
      const nextAttachment = refreshAttachmentNotes({
        ...attachment,
        reviewedText,
        status:
          attachment.documentDraft?.sourceSummaryText?.trim()
          || reviewedText?.trim()
            ? 'included'
            : 'reference_only',
      })

      includedSourceText = getAttachmentSourceText(nextAttachment)
      return nextAttachment
    })

    if (sourceKey === 'iep' && includedSourceText) {
      updateMainSource(sourceKey, (current) => ({
        ...current,
        text: mergeSourceTextBlock(current.text, includedSourceText),
      }))
    }
  }

  function includeCorrectionAttachmentSource(
    sourceKey: SourceKey,
    attachmentId: string,
  ) {
    let includedSourceText = ''

    patchCorrectionAttachment(sourceKey, attachmentId, (attachment) => {
      const reviewedText =
        (attachment.reviewedText ?? attachment.extractedText ?? '').trim()
          ? attachment.reviewedText ?? attachment.extractedText
          : undefined
      const nextAttachment = refreshAttachmentNotes({
        ...attachment,
        reviewedText,
        status:
          attachment.documentDraft?.sourceSummaryText?.trim()
          || reviewedText?.trim()
            ? 'included'
            : 'reference_only',
      })

      includedSourceText = getAttachmentSourceText(nextAttachment)
      return nextAttachment
    })

    if (sourceKey === 'iep' && includedSourceText) {
      updateCorrectionSource(sourceKey, (current) => ({
        ...current,
        text: mergeSourceTextBlock(current.text, includedSourceText),
      }))
    }
  }

  function keepMainAttachmentReference(sourceKey: SourceKey, attachmentId: string) {
    patchMainAttachment(sourceKey, attachmentId, (attachment) =>
      refreshAttachmentNotes({
        ...attachment,
        reviewedText: undefined,
        status: 'reference_only',
      }),
    )
  }

  function keepCorrectionAttachmentReference(
    sourceKey: SourceKey,
    attachmentId: string,
  ) {
    patchCorrectionAttachment(sourceKey, attachmentId, (attachment) =>
      refreshAttachmentNotes({
        ...attachment,
        reviewedText: undefined,
        status: 'reference_only',
      }),
    )
  }

  function removeMainAttachment(sourceKey: SourceKey, attachmentId: string) {
    if (sourceKey === 'iep') {
      setShouldPersistIepSource(true)
      setIepSource((current) => {
        const attachmentToRemove = current.attachments.find(
          (attachment) => attachment.id === attachmentId,
        )

        if (attachmentToRemove) {
          revokeAttachmentPreview(attachmentToRemove)
        }

        return {
          ...current,
          attachments: current.attachments.filter(
            (attachment) => attachment.id !== attachmentId,
          ),
        }
      })
    } else {
      setTaskSource((current) => {
        const attachmentToRemove = current.attachments.find(
          (attachment) => attachment.id === attachmentId,
        )

        if (attachmentToRemove) {
          revokeAttachmentPreview(attachmentToRemove)
        }

        return {
          ...current,
          attachments: current.attachments.filter(
            (attachment) => attachment.id !== attachmentId,
          ),
        }
      })
    }

    setActiveExampleId(null)
    setAnalysisError(null)
    clearTeacherConcernState()
  }

  function removeCorrectionAttachment(sourceKey: SourceKey, attachmentId: string) {
    const retainedIds = new Set(
      (sourceKey === 'iep' ? iepSource.attachments : taskSource.attachments).map(
        (attachment) => attachment.id,
      ),
    )

    if (sourceKey === 'iep') {
      setCorrectionIepSource((current) => {
        const attachmentToRemove = current.attachments.find(
          (attachment) => attachment.id === attachmentId,
        )

        if (attachmentToRemove && !retainedIds.has(attachmentToRemove.id)) {
          revokeAttachmentPreview(attachmentToRemove)
        }

        return {
          ...current,
          attachments: current.attachments.filter(
            (attachment) => attachment.id !== attachmentId,
          ),
        }
      })
    } else {
      setCorrectionTaskSource((current) => {
        const attachmentToRemove = current.attachments.find(
          (attachment) => attachment.id === attachmentId,
        )

        if (attachmentToRemove && !retainedIds.has(attachmentToRemove.id)) {
          revokeAttachmentPreview(attachmentToRemove)
        }

        return {
          ...current,
          attachments: current.attachments.filter(
            (attachment) => attachment.id !== attachmentId,
          ),
        }
      })
    }
  }

  function applyExample(exampleId: string) {
    const nextExample = exampleScenarios.find((example) => example.id === exampleId)

    if (!nextExample) {
      return
    }

    replaceIepSource(
      {
        attachments: [],
        text: nextExample.iepExcerpt,
      },
      { persist: false },
    )
    replaceTaskSource({
      attachments: [],
      text: nextExample.taskText,
    })
    cancelPendingAnalysis()
    setActiveExampleId(nextExample.id)
    setContextTags(nextExample.contextTags)
    setTaskTitle(nextExample.taskTitle)
    setTeacherConcern(nextExample.teacherConcern ?? '')
    setAnalysis(null)
    setAnalysisError(null)
    setCorrectionIepSource((current) => {
      revokeRemovedAttachments(current.attachments, [])
      return createBlankSource()
    })
    setCorrectionTaskSource((current) => {
      revokeRemovedAttachments(current.attachments, [])
      return createBlankSource()
    })
    setCorrectionTaskTitle(nextExample.taskTitle)
    setCorrectionTeacherConcern(nextExample.teacherConcern ?? '')
    setCorrectionContextTags(nextExample.contextTags)
    setCorrectionTarget(null)
    setScreen('iep')
  }

  function resetAllState() {
    cancelPendingAnalysis()
    replaceIepSource(getRestoredIepSource())
    replaceTaskSource(createBlankSource())

    setCorrectionIepSource((current) => {
      revokeRemovedAttachments(current.attachments, [])
      return createBlankSource()
    })
    setCorrectionTaskSource((current) => {
      revokeRemovedAttachments(current.attachments, [])
      return createBlankSource()
    })

    setContextTags([])
    setTaskTitle('')
    setLearningProfile('')
    setTeacherConcern('')
    setActiveExampleId(null)
    setAnalysis(null)
    setAnalysisError(null)
    setCorrectionTaskTitle('')
    setCorrectionTeacherConcern('')
    setCorrectionContextTags([])
    setCorrectionTarget(null)
    setScreen('iep')
  }

  function buildTeacherConcernRequest(
    nextIepSource: SourceMaterial,
    nextTaskSource: SourceMaterial,
    nextTaskTitle: string,
    nextLearningProfile: string,
    nextTeacherConcern: string,
    nextContextTags: TaskContext[],
  ): TeacherConcernRequest | null {
    const trimmedConcern = nextTeacherConcern.trim()

    if (!trimmedConcern) {
      return null
    }

    return {
      contextTags: nextContextTags,
      iepSource: getAnalysisSource(nextIepSource),
      learningProfile: nextLearningProfile.trim(),
      taskTraits: getAnalysisTaskTraits(nextTaskSource),
      taskTitle: nextTaskTitle.trim(),
      taskSource: getAnalysisSource(nextTaskSource),
      teacherConcern: trimmedConcern,
    }
  }

  async function runPrimaryAnalysis(
    nextIepSource: SourceMaterial,
    nextTaskSource: SourceMaterial,
    nextTaskTitle: string,
    nextLearningProfile: string,
    nextContextTags: TaskContext[],
  ) {
    const runId = analysisRunIdRef.current + 1
    analysisRunIdRef.current = runId

    setScreen('results')
    setIsAnalyzing(true)
    setAnalysis(null)
    setAnalysisError(null)
    clearTeacherConcernState()

    try {
      const nextAnalysis = await analysisAdapter.analyze({
        contextTags: nextContextTags,
        iepSource: getAnalysisSource(nextIepSource),
        learningProfile: nextLearningProfile.trim(),
        taskTraits: getAnalysisTaskTraits(nextTaskSource),
        taskTitle: nextTaskTitle.trim(),
        taskSource: getAnalysisSource(nextTaskSource),
      })

      if (analysisRunIdRef.current !== runId) {
        return false
      }

      setAnalysis(nextAnalysis)
      return true
    } catch (error) {
      if (analysisRunIdRef.current !== runId) {
        return false
      }

      setAnalysisError(formatErrorMessage(error))
      return false
    } finally {
      if (analysisRunIdRef.current === runId) {
        setIsAnalyzing(false)
      }
    }
  }

  async function runTeacherConcernFollowUp(
    request: TeacherConcernRequest | null,
  ) {
    if (!request) {
      clearTeacherConcernState()
      return
    }

    const runId = teacherConcernRunIdRef.current + 1
    teacherConcernRunIdRef.current = runId

    setTeacherConcernAnalysis(null)
    setTeacherConcernError(null)
    setIsTeacherConcernAnalyzing(true)

    try {
      const nextEvaluation = await analysisAdapter.analyzeTeacherConcern(request)

      if (teacherConcernRunIdRef.current !== runId) {
        return
      }

      setTeacherConcernAnalysis(nextEvaluation)
    } catch (error) {
      if (teacherConcernRunIdRef.current !== runId) {
        return
      }

      setTeacherConcernError(formatErrorMessage(error))
    } finally {
      if (teacherConcernRunIdRef.current === runId) {
        setIsTeacherConcernAnalyzing(false)
      }
    }
  }

  async function handleGenerateOutput() {
    if (!hasUsableSourceText(iepSource) || !hasUsableSourceText(taskSource)) {
      return
    }

    const didGenerate = await runPrimaryAnalysis(
      iepSource,
      taskSource,
      taskTitle,
      learningProfile,
      contextTags,
    )
    if (!didGenerate) {
      return
    }
  }

  async function handleRegenerateFromCorrection() {
    const nextIepSource = correctionIepSource
    const nextTaskSource = correctionTaskSource
    const nextTaskTitle = correctionTaskTitle
    const nextLearningProfile = learningProfile
    const nextTeacherConcern = correctionTeacherConcern
    const nextContextTags = correctionContextTags

    replaceIepSource(nextIepSource, {
      persist: shouldPersistIepSource,
    })
    replaceTaskSource(nextTaskSource)
    setTaskTitle(nextTaskTitle)
    setTeacherConcern(nextTeacherConcern)
    setContextTags(nextContextTags)
    setActiveExampleId(null)
    setCorrectionTarget(null)

    const didGenerate = await runPrimaryAnalysis(
      nextIepSource,
      nextTaskSource,
      nextTaskTitle,
      nextLearningProfile,
      nextContextTags,
    )
    if (!didGenerate) {
      return
    }
  }

  async function handleTeacherConcernReview() {
    if (isAnalyzing) {
      return
    }

    await runTeacherConcernFollowUp(
      buildTeacherConcernRequest(
        iepSource,
        taskSource,
        taskTitle,
        learningProfile,
        teacherConcern,
        contextTags,
      ),
    )
  }

  function clearSavedIepFromDevice() {
    clearPersistedIepSource()
    setHasSavedIepOnDevice(false)
    cancelPendingAnalysis()
    replaceIepSource(createBlankSource())
    setActiveExampleId(null)
    setAnalysis(null)
    setAnalysisError(null)
    setCorrectionIepSource((current) => {
      revokeRemovedAttachments(current.attachments, [])
      return createBlankSource()
    })
    clearTeacherConcernState()
  }

  const canContinueToAssignment = hasUsableSourceText(iepSource)
  const canGenerateOutput =
    hasUsableSourceText(iepSource) &&
    hasUsableSourceText(taskSource) &&
    Boolean(taskTitle.trim())
  const canAddressTeacherConcern =
    !isAnalyzing &&
    hasUsableSourceText(iepSource) &&
    hasUsableSourceText(taskSource) &&
    Boolean(taskTitle.trim()) &&
    Boolean(teacherConcern.trim())
  const canRegenerateFromCorrection =
    hasUsableSourceText(correctionIepSource) &&
    hasUsableSourceText(correctionTaskSource) &&
    Boolean(correctionTaskTitle.trim())
  const showOptionalTaskSetup =
    contextTags.length > 0 ||
    Boolean(teacherConcern.trim())
  const showCorrectionOptionalTaskSetup =
    correctionContextTags.length > 0 ||
    Boolean(correctionTeacherConcern.trim())
  const isPreviewingExampleIep = !shouldPersistIepSource

  return (
    <div className="app-shell">
      <div className="app-shell__glow app-shell__glow--warm" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--cool" aria-hidden="true" />

      <div className="app-frame">
        {screen === 'iep' ? (
          <header className="app-header">
            <div className="app-header__copy">
              <div className="app-header__eyebrow-row">
                <span className="eyebrow eyebrow--hero">
                  <AppIcon name="compass" className="button-icon button-icon--sm" />
                  Phone-first IEP accommodation guidance
                </span>
                <span className="hero-mini-badge">
                  <AppIcon name="star" className="button-icon button-icon--sm" />
                  Supportive by design
                </span>
              </div>

              <div className="app-header__main">
                <div className="app-header__headline">
                  <h1>IEP Compass</h1>
                  <p className="app-header__lede">
                    Start with the approved IEP wording. Then add the assignment
                    so we can map out what may apply, what to ask for, and what
                    still needs a quick check.
                  </p>

                  <ul className="hero-guide-list">
                    {HERO_GUIDEPOINTS.map((point) => (
                      <li key={point.text}>
                        <span className="hero-guide-list__icon" aria-hidden="true">
                          <AppIcon name={point.icon} />
                        </span>
                        <span>{point.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="hero-compass-card" aria-hidden="true">
                  <div className="hero-compass-card__ring" />
                  <div className="hero-compass-card__orbit hero-compass-card__orbit--one" />
                  <div className="hero-compass-card__orbit hero-compass-card__orbit--two" />
                  <div className="hero-compass-card__trail hero-compass-card__trail--one" />
                  <div className="hero-compass-card__trail hero-compass-card__trail--two" />
                  <div className="hero-compass-card__center">
                    <AppIcon name="waypoint" />
                  </div>
                  <div className="hero-compass-card__spark hero-compass-card__spark--one">
                    <AppIcon name="spark" />
                  </div>
                  <div className="hero-compass-card__spark hero-compass-card__spark--two">
                    <AppIcon name="star" />
                  </div>
                  <div className="hero-compass-card__note hero-compass-card__note--top">
                    <AppIcon name="notebook" className="button-icon button-icon--sm" />
                    Start with approved accommodations
                  </div>
                  <div className="hero-compass-card__note hero-compass-card__note--bottom">
                    <AppIcon name="results" className="button-icon button-icon--sm" />
                    Follow the checkpoint trail
                  </div>
                </div>
              </div>

              <div className="hero-trust-strip" aria-label="Grounded boundaries">
                {TRUST_BOUNDARIES.map((boundary) => (
                  <div key={boundary.title} className="hero-trust-item">
                    <span className="hero-trust-item__icon" aria-hidden="true">
                      <AppIcon name={boundary.icon} />
                    </span>
                    <div>
                      <strong>{boundary.title}</strong>
                      <p>{boundary.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </header>
        ) : (
          <header className="app-header app-header--compact">
            <div className="app-header__compact">
              <div className="app-header__compact-copy">
                <span className="eyebrow eyebrow--hero">
                  <AppIcon name="waypoint" className="button-icon button-icon--sm" />
                  Guided accommodation check
                </span>
                <h1>IEP Compass</h1>
              </div>

              <button
                className="ghost-button"
                type="button"
                disabled={isAnalyzing || isTeacherConcernAnalyzing}
                onClick={resetAllState}
              >
                <AppIcon name="compass" className="button-icon" />
                Start over
              </button>
            </div>
          </header>
        )}

        <nav className="progress-strip" aria-label="Progress">
          {STEP_CONFIG.map((step, index) => {
            const isActive = screen === step.id
            const isComplete =
              (step.id === 'iep' && (screen === 'assignment' || screen === 'results')) ||
              (step.id === 'assignment' && screen === 'results')
            const stepStatus = isComplete
              ? 'Done'
              : isActive
                ? 'Now'
                : 'Up next'

            return (
              <div
                key={step.id}
                className={`progress-step progress-step--${step.id}${
                  isActive ? ' progress-step--active' : ''
                }${isComplete ? ' progress-step--complete' : ''}`}
              >
                <div className="progress-step__marker">
                  <span className="progress-step__index">{index + 1}</span>
                  <span className="progress-step__icon" aria-hidden="true">
                    <AppIcon name={isComplete ? 'check' : step.icon} />
                  </span>
                </div>
                <div className="progress-step__body">
                  <div className="progress-step__heading">
                    <strong>{step.label}</strong>
                    <span className="progress-step__status">{stepStatus}</span>
                  </div>
                  <p>{step.helper}</p>
                </div>
              </div>
            )
          })}
        </nav>

        <main className="screen-stack">
          {screen === 'iep' ? (
            <>
              <SectionCard
                eyebrow="Waypoint 1"
                title="Start with the approved accommodation wording"
                description="Paste the IEP lines you want the app to rely on. Backup files are optional if they help confirm the source trail."
                icon={<AppIcon name="notebook" />}
                footer={
                  <div className="screen-actions">
                    <button
                      className="action-button"
                      type="button"
                      disabled={!canContinueToAssignment}
                      onClick={() => setScreen('assignment')}
                    >
                      <AppIcon name="assignment" className="button-icon" />
                      Next: add the task
                    </button>
                  </div>
                }
              >
                <SourceEditor
                  attachments={iepSource.attachments}
                  documentPlan={documentPlan}
                  children={
                    <div className="local-save-note">
                      <div className="local-save-note__copy">
                        <span className="eyebrow">
                          <AppIcon name="shield" className="button-icon button-icon--sm" />
                          {isPreviewingExampleIep
                            ? 'Sample details only'
                            : hasSavedIepOnDevice
                            ? 'Saved on this device'
                            : 'Local-only IEP details'}
                        </span>
                        <p className="field-message">
                          {isPreviewingExampleIep
                            ? hasSavedIepOnDevice
                              ? 'This preview does not replace the saved IEP on this device. Start over to bring the saved wording back. Assignment details and uploaded files are not saved here.'
                              : 'This preview is just for practice and will not be saved on this device. Assignment details and uploaded files are not saved here.'
                            : hasSavedIepOnDevice
                            ? 'The approved IEP wording on this screen comes back automatically in this browser. Paste new wording here any time to replace it. Uploaded IEP files and assignment details are not saved here.'
                            : 'When you add approved IEP wording here, it stays only in this browser. Paste new wording here any time to replace it later. Uploaded IEP files and assignment details are not saved here.'}
                        </p>
                      </div>

                      {hasSavedIepOnDevice ? (
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={clearSavedIepFromDevice}
                        >
                          Clear saved IEP
                        </button>
                      ) : null}
                    </div>
                  }
                  textHelp="Keep this to the approved wording you want cited back in the results. If you have several accommodations, a short list is easier to scan than a long paragraph."
                  textLabel="Approved IEP wording"
                  textName="iepExcerpt"
                  textPlaceholder={`Example:\n- Extended time for quizzes and tests\n- Reduced-distraction setting for assessments\n- Directions clarified and chunked`}
                  textValue={iepSource.text}
                  onAttachmentDocumentDraftChange={(attachmentId, nextDraft) =>
                    updateMainAttachmentDocumentDraft('iep', attachmentId, nextDraft)
                  }
                  onAttachmentTextDraftChange={(attachmentId, nextValue) =>
                    updateMainAttachmentTextDraft('iep', attachmentId, nextValue)
                  }
                  onKeepAttachmentReference={(attachmentId) =>
                    keepMainAttachmentReference('iep', attachmentId)
                  }
                  onRunAttachmentInterpretation={(attachmentId) =>
                    runMainAttachmentInterpretation('iep', attachmentId)
                  }
                  onTextChange={updateMainIepText}
                  onUseAttachmentSource={(attachmentId) =>
                    includeMainAttachmentSource('iep', attachmentId)
                  }
                  onChooseFiles={(files) => appendFilesToMainSource('iep', files)}
                  onRemoveAttachment={(attachmentId) =>
                    removeMainAttachment('iep', attachmentId)
                  }
                  uploadEmptyBadge="Recommended first"
                  uploadGuidance="Use photos, screenshots, PDFs, or text files if that is the easiest way to bring in the approved IEP wording. After review, included file details can count in the source trail."
                  uploadSummaryTitle="Start with a photo or file"
                  uploadsFirst
                  emptyState="No files yet. Skip this if typing the IEP wording is easier."
                  textFootnote={
                    <>
                      <label className="textarea-label">
                        <span className="field-label__title">
                          Learning profile notes (optional)
                        </span>
                        <textarea
                          className="textarea-input textarea-input--compact"
                          name="learningProfile"
                          placeholder="Example: Auditory dyslexia that affects sound-symbol encoding."
                          value={learningProfile}
                          onChange={(event) => {
                            setLearningProfile(event.target.value)
                            markMainSourceChanged()
                          }}
                        />
                        <span className="field-label__help">
                          Add only if helpful. This context can guide explanations,
                          but accommodations still must come from the approved IEP
                          wording above.
                        </span>
                      </label>

                      {!canContinueToAssignment ? (
                        <p className="field-message">
                          Add at least one reviewed accommodation before moving on.
                          Reviewed upload details from files can also count.
                        </p>
                      ) : null}
                    </>
                  }
                />
                <details className="optional-panel">
                  <summary className="optional-panel__summary">
                    <span className="summary-label">
                      <AppIcon name="spark" className="button-icon button-icon--sm" />
                      Prefer a preview first?
                    </span>
                    <span className="meta-badge">Load a sample</span>
                  </summary>

                  <div className="optional-panel__body">
                    <p className="field-message">
                      Use a realistic scenario to preview the flow before you enter
                      a real student&apos;s materials.
                    </p>

                    <div className="example-grid">
                      {exampleScenarios.map((example) => {
                        const isActive = example.id === activeExampleId

                        return (
                          <button
                            key={example.id}
                            className={`example-card${
                              isActive ? ' example-card--active' : ''
                            }`}
                            type="button"
                            onClick={() => applyExample(example.id)}
                          >
                            <div>
                              <h3 className="example-card__title">{example.title}</h3>
                              <p className="example-card__summary">{example.summary}</p>
                            </div>

                            <div className="example-card__footer">
                              {example.contextTags.slice(0, 2).map((tag) => (
                                <span key={tag} className="mini-chip">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </details>
              </SectionCard>
            </>
          ) : null}

          {screen === 'assignment' ? (
            <>
              <SectionCard
                eyebrow="Waypoint 2"
                title="Add the assignment, quiz, or worksheet"
                description="Start with the task title and directions. Add extra tags or one school question only if they make this task clearer."
                icon={<AppIcon name="assignment" />}
                footer={
                  <div className="screen-actions screen-actions--split">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setScreen('iep')}
                    >
                      <AppIcon name="notebook" className="button-icon" />
                      Back to IEP details
                    </button>

                    <button
                      className="action-button"
                      type="button"
                      disabled={!canGenerateOutput || isAnalyzing}
                      onClick={() => void handleGenerateOutput()}
                    >
                      {isAnalyzing ? (
                        <LoadingIndicator label="Generating output" size="sm" />
                      ) : (
                        <>
                          <AppIcon name="results" className="button-icon" />
                          Check what may apply
                        </>
                      )}
                    </button>
                  </div>
                }
              >
                <div className="field-label">
                  <span className="field-label__title">Task title</span>
                  <p className="field-label__help">
                    Keep this short so it is easy to spot later.
                  </p>
                  <input
                    className="text-input"
                    name="taskTitle"
                    placeholder="Example: Personal narrative essay"
                    value={taskTitle}
                    onChange={(event) => {
                      setTaskTitle(event.target.value)
                      setActiveExampleId(null)
                      setAnalysisError(null)
                      clearTeacherConcernState()
                    }}
                  />
                </div>

                <SourceEditor
                  attachments={taskSource.attachments}
                  documentPlan={documentPlan}
                  textHelp="Paste directions or summarize what the student is being asked to do. Keep this to the task itself, not the answer."
                  textLabel="Task directions or worksheet details"
                  textName="taskText"
                  textPlaceholder="Paste directions, summarize a worksheet photo, or upload a text file with the assignment details."
                  textValue={taskSource.text}
                  onAttachmentDocumentDraftChange={(attachmentId, nextDraft) =>
                    updateMainAttachmentDocumentDraft('task', attachmentId, nextDraft)
                  }
                  onAttachmentTextDraftChange={(attachmentId, nextValue) =>
                    updateMainAttachmentTextDraft('task', attachmentId, nextValue)
                  }
                  onKeepAttachmentReference={(attachmentId) =>
                    keepMainAttachmentReference('task', attachmentId)
                  }
                  onRunAttachmentInterpretation={(attachmentId) =>
                    runMainAttachmentInterpretation('task', attachmentId)
                  }
                  onTextChange={(nextValue) => {
                    setTaskSource((current) => ({ ...current, text: nextValue }))
                    setActiveExampleId(null)
                    setAnalysisError(null)
                    clearTeacherConcernState()
                  }}
                  onUseAttachmentSource={(attachmentId) =>
                    includeMainAttachmentSource('task', attachmentId)
                  }
                  onChooseFiles={(files) => appendFilesToMainSource('task', files)}
                  onRemoveAttachment={(attachmentId) =>
                    removeMainAttachment('task', attachmentId)
                  }
                  uploadGuidance="Add screenshots, photos, PDFs, or text files only if they help show what the student is actually being asked to do. Image and PDF uploads can be interpreted into a structured task draft before analysis."
                  emptyState="No task files yet. Skip this if the typed task summary already covers what matters."
                />

                <details className="optional-panel" open={showOptionalTaskSetup}>
                  <summary className="optional-panel__summary">
                    <span className="summary-label">
                      <AppIcon name="waypoint" className="button-icon button-icon--sm" />
                      Helpful extras
                    </span>
                    <span className="meta-badge">
                      {showOptionalTaskSetup ? 'Added' : 'Use only if helpful'}
                    </span>
                  </summary>

                  <div className="optional-panel__body">
                    <label className="textarea-label">
                      <span className="field-label__title">School staff question</span>
                      <textarea
                        className="textarea-input textarea-input--compact"
                        name="teacherConcern"
                        placeholder="Example: The teacher wants to count off heavily for spelling mistakes on this essay."
                        value={teacherConcern}
                        onChange={(event) => {
                          updateMainTeacherConcern(event.target.value)
                          setActiveExampleId(null)
                          setAnalysisError(null)
                        }}
                      />
                      <span className="field-label__help">
                        Add this only if there is one school question you want to
                        check after the main accommodation map.
                      </span>
                    </label>

                    <TaskSetupFields
                      contextTags={contextTags}
                      onContextToggle={(nextContext) => {
                        setContextTags((current) =>
                          current.includes(nextContext)
                            ? current.filter((contextTag) => contextTag !== nextContext)
                            : [...current, nextContext],
                        )
                        setActiveExampleId(null)
                        setAnalysisError(null)
                        clearTeacherConcernState()
                      }}
                    />
                  </div>
                </details>

                <details className="optional-panel optional-panel--testing">
                  <summary className="optional-panel__summary">
                    <span className="summary-label">
                      <AppIcon name="spark" className="button-icon button-icon--sm" />
                      Testing and model notes
                    </span>
                    <span className="meta-badge">Secondary</span>
                  </summary>

                  <div className="optional-panel__body stacked-copy">
                    <p className="field-message">
                      Model plan: {modelPlan.primaryLabel} first, then{' '}
                      {modelPlan.fallbackLabel}.
                      {modelPlan.liveConfigured
                        ? ` ${modelPlan.runtimeLabel} is configured for live analysis.`
                        : ' No endpoint is configured, so the app will use structured demo analysis.'}
                    </p>
                    <p className="field-message">
                      This testing surface is separate from the main student-facing
                      flow so it does not add extra steps to the core journey.
                    </p>
                    <BrowserGemmaApp localModelPlan={modelPlan} />
                  </div>
                </details>
              </SectionCard>
            </>
          ) : null}

          {screen === 'results' ? (
            <>
              {correctionTarget === 'iep' ? (
                <SectionCard
                  eyebrow="Correct details"
                  title="Update the IEP source trail"
                  description="Fix anything we missed in the IEP details, then regenerate from the updated version."
                  icon={<AppIcon name="notebook" />}
                  footer={
                    <div className="screen-actions screen-actions--split">
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => syncCorrectionDrafts(null)}
                      >
                        <AppIcon name="waypoint" className="button-icon" />
                        Cancel
                      </button>

                      <button
                        className="action-button"
                        type="button"
                        disabled={!canRegenerateFromCorrection || isAnalyzing}
                        onClick={() => void handleRegenerateFromCorrection()}
                      >
                        {isAnalyzing ? (
                          <LoadingIndicator label="Regenerating output" size="sm" />
                        ) : (
                          <>
                            <AppIcon name="results" className="button-icon" />
                            Regenerate accommodation map
                          </>
                        )}
                      </button>
                    </div>
                  }
                >
                  <SourceEditor
                    attachments={correctionIepSource.attachments}
                    documentPlan={documentPlan}
                    textHelp="Fix the approved wording here if the first pass missed something important or cited the wrong detail."
                    textLabel="Approved IEP wording"
                    textName="correctionIepExcerpt"
                    textPlaceholder={`Example:\n- Extended time for quizzes and tests\n- Reduced-distraction setting for assessments\n- Directions clarified and chunked`}
                    textValue={correctionIepSource.text}
                    onAttachmentDocumentDraftChange={(attachmentId, nextDraft) =>
                      updateCorrectionAttachmentDocumentDraft('iep', attachmentId, nextDraft)
                    }
                    onAttachmentTextDraftChange={(attachmentId, nextValue) =>
                      updateCorrectionAttachmentTextDraft('iep', attachmentId, nextValue)
                    }
                    onKeepAttachmentReference={(attachmentId) =>
                      keepCorrectionAttachmentReference('iep', attachmentId)
                    }
                    onRunAttachmentInterpretation={(attachmentId) =>
                      runCorrectionAttachmentInterpretation('iep', attachmentId)
                    }
                    onTextChange={(nextValue) =>
                      setCorrectionIepSource((current) => ({
                        ...current,
                        text: nextValue,
                      }))
                    }
                    onUseAttachmentSource={(attachmentId) =>
                      includeCorrectionAttachmentSource('iep', attachmentId)
                    }
                    onChooseFiles={(files) =>
                      appendFilesToCorrectionSource('iep', files)
                    }
                    onRemoveAttachment={(attachmentId) =>
                      removeCorrectionAttachment('iep', attachmentId)
                    }
                    uploadEmptyBadge="Recommended first"
                    uploadGuidance="Use a photo, screenshot, PDF, or text file if that is the easiest way to correct the IEP wording."
                    uploadSummaryTitle="Start with a photo or file"
                    uploadsFirst
                    emptyState="No files in this correction draft yet."
                  />
                </SectionCard>
              ) : null}

              {correctionTarget === 'assignment' ? (
                <SectionCard
                  eyebrow="Correct details"
                  title="Update the assignment source trail"
                  description="Refine the assignment details, helpful tags, or school question, then regenerate from the corrected version."
                  icon={<AppIcon name="assignment" />}
                  footer={
                    <div className="screen-actions screen-actions--split">
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => syncCorrectionDrafts(null)}
                      >
                        <AppIcon name="waypoint" className="button-icon" />
                        Cancel
                      </button>

                      <button
                        className="action-button"
                        type="button"
                        disabled={!canRegenerateFromCorrection || isAnalyzing}
                        onClick={() => void handleRegenerateFromCorrection()}
                      >
                        {isAnalyzing ? (
                          <LoadingIndicator label="Regenerating output" size="sm" />
                        ) : (
                          <>
                            <AppIcon name="results" className="button-icon" />
                            Regenerate accommodation map
                          </>
                        )}
                      </button>
                    </div>
                  }
                >
                  <div className="field-label">
                    <span className="field-label__title">Task title</span>
                    <p className="field-label__help">
                      Update the title too if the original label was vague or off.
                    </p>
                    <input
                      className="text-input"
                      name="correctionTaskTitle"
                      placeholder="Example: Personal narrative essay"
                      value={correctionTaskTitle}
                      onChange={(event) =>
                        setCorrectionTaskTitle(event.target.value)
                      }
                    />
                  </div>

                  <SourceEditor
                    attachments={correctionTaskSource.attachments}
                    documentPlan={documentPlan}
                    textHelp="Tighten the task wording here so the results match what the student is actually being asked to do."
                    textLabel="Task directions or worksheet details"
                    textName="correctionTaskText"
                    textPlaceholder="Paste directions, summarize a worksheet photo, or upload a text file with the assignment details."
                    textValue={correctionTaskSource.text}
                    onAttachmentDocumentDraftChange={(attachmentId, nextDraft) =>
                      updateCorrectionAttachmentDocumentDraft(
                        'task',
                        attachmentId,
                        nextDraft,
                      )
                    }
                    onAttachmentTextDraftChange={(attachmentId, nextValue) =>
                      updateCorrectionAttachmentTextDraft(
                        'task',
                        attachmentId,
                        nextValue,
                      )
                    }
                    onKeepAttachmentReference={(attachmentId) =>
                      keepCorrectionAttachmentReference('task', attachmentId)
                    }
                    onRunAttachmentInterpretation={(attachmentId) =>
                      runCorrectionAttachmentInterpretation('task', attachmentId)
                    }
                    onTextChange={(nextValue) =>
                      setCorrectionTaskSource((current) => ({
                        ...current,
                        text: nextValue,
                      }))
                    }
                    onUseAttachmentSource={(attachmentId) =>
                      includeCorrectionAttachmentSource('task', attachmentId)
                    }
                    onChooseFiles={(files) =>
                      appendFilesToCorrectionSource('task', files)
                    }
                    onRemoveAttachment={(attachmentId) =>
                      removeCorrectionAttachment('task', attachmentId)
                    }
                    uploadGuidance="Swap in a clearer worksheet photo or file only if it helps show the corrected task details."
                    emptyState="No task files in this correction draft yet."
                  />

                  <details
                    className="optional-panel"
                    open={showCorrectionOptionalTaskSetup}
                  >
                    <summary className="optional-panel__summary">
                      <span className="summary-label">
                        <AppIcon name="waypoint" className="button-icon button-icon--sm" />
                        Helpful extras
                      </span>
                      <span className="meta-badge">
                        {showCorrectionOptionalTaskSetup ? 'Added' : 'Optional'}
                      </span>
                    </summary>

                    <div className="optional-panel__body">
                      <label className="textarea-label">
                        <span className="field-label__title">School staff question</span>
                        <textarea
                          className="textarea-input textarea-input--compact"
                          name="correctionTeacherConcern"
                          placeholder="Example: The teacher wants to count off heavily for spelling mistakes on this essay."
                          value={correctionTeacherConcern}
                          onChange={(event) =>
                            setCorrectionTeacherConcern(event.target.value)
                          }
                        />
                      </label>

                      <TaskSetupFields
                        contextTags={correctionContextTags}
                        onContextToggle={(nextContext) => {
                          setCorrectionContextTags((current) =>
                            current.includes(nextContext)
                              ? current.filter(
                                  (contextTag) => contextTag !== nextContext,
                                )
                              : [...current, nextContext],
                          )
                        }}
                      />
                    </div>
                  </details>
                </SectionCard>
              ) : null}

              {isAnalyzing ? (
                <SectionCard
                  eyebrow="Working"
                  title="Building the accommodation map"
                  description="The results screen stays in place while IEP Compass checks the latest source materials."
                  icon={<AppIcon name="compass" />}
                >
                  <div className="loading-card">
                    <LoadingIndicator label="Checking the task against the approved accommodations" />
                    <p>
                      We&apos;re only using the approved accommodations visible in the
                      current source trail.
                    </p>
                  </div>
                </SectionCard>
              ) : null}

              {analysisError ? (
                <SectionCard
                  title="This pass needs another try"
                  tone="accent"
                  description={analysisError}
                  icon={<AppIcon name="flag" />}
                >
                  <div className="placeholder-stack">
                    <p>
                      Review the source panels or open a correction flow, then
                      try again when the materials look right.
                    </p>
                    <div className="screen-actions">
                      <button
                        className="action-button"
                        type="button"
                        disabled={!canGenerateOutput || isAnalyzing}
                        onClick={() => void handleGenerateOutput()}
                      >
                        <AppIcon name="results" className="button-icon" />
                        Try again
                      </button>
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              {analysis ? (
                <ResultsView analysis={analysis} />
              ) : null}

              {analysis ? (
                <SectionCard
                  eyebrow="Optional follow-up"
                  title="Check one school question"
                  description="Use this only if you want help thinking through one question about how an accommodation may be used."
                  icon={<AppIcon name="teacher" />}
                >
                  <details
                    className="optional-panel"
                    open={Boolean(teacherConcern.trim()) || Boolean(teacherConcernAnalysis)}
                  >
                    <summary className="optional-panel__summary">
                      <span className="summary-label">
                        <AppIcon name="quote" className="button-icon button-icon--sm" />
                        Add one question to check
                      </span>
                      <span className="meta-badge">
                        {teacherConcernAnalysis ? 'Reviewed' : 'Optional'}
                      </span>
                    </summary>

                    <div className="optional-panel__body teacher-concern-stack">
                      <label className="textarea-label">
                        <span className="field-label__title">School staff question</span>
                        <textarea
                          className="textarea-input textarea-input--compact"
                          name="resultsTeacherConcern"
                          placeholder="Example: The teacher wants to count off heavily for spelling mistakes on this essay."
                          value={teacherConcern}
                          onChange={(event) => {
                            updateMainTeacherConcern(event.target.value)
                          }}
                        />
                      </label>

                      <div className="screen-actions screen-actions--split">
                        <p className="review-note">
                          This runs separately from the main accommodation map so it can
                          think through one school question at a time.
                        </p>

                        <button
                          className="action-button action-button--secondary"
                          type="button"
                          disabled={!canAddressTeacherConcern || isTeacherConcernAnalyzing}
                          onClick={() => void handleTeacherConcernReview()}
                        >
                          {isTeacherConcernAnalyzing ? (
                            <LoadingIndicator label="Checking follow-up" size="sm" />
                          ) : (
                            <>
                              <AppIcon name="quote" className="button-icon" />
                              Check this question
                            </>
                          )}
                        </button>
                      </div>

                      {teacherConcernError ? (
                        <p className="field-message field-message--warning">
                          {teacherConcernError}
                        </p>
                      ) : null}

                      {teacherConcernAnalysis ? (
                        <div className="teacher-concern-response">
                          <div className="teacher-concern-response__header">
                            <h3>Focused answer</h3>
                            <span className="meta-badge">
                              {
                                TEACHER_CONCERN_VERDICT_LABELS[
                                  teacherConcernAnalysis.result.verdict
                                ]
                              }
                            </span>
                          </div>

                          <div className="results-detail-block">
                            <h3>Question</h3>
                            <p>{teacherConcernAnalysis.result.concern}</p>
                          </div>

                          <div className="results-detail-block">
                            <h3>What it suggests</h3>
                            <p>{teacherConcernAnalysis.result.guidance}</p>
                          </div>

                          <div className="results-detail-block">
                            <h3>How to explain it</h3>
                            <p>{teacherConcernAnalysis.result.suggestedResponse}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </SectionCard>
              ) : null}

              {analysis || analysisError ? (
                <SectionCard
                  eyebrow="Need to dig in?"
                  title="Review sources or verify details"
                  description="Open this only if a recommendation looks off or you want to inspect the exact source materials."
                  icon={<AppIcon name="source" />}
                >
                  <details className="results-details-panel">
                    <summary className="results-details-panel__summary">
                      <span className="summary-label">
                        <AppIcon name="source" className="button-icon button-icon--sm" />
                        Open source review
                      </span>
                    </summary>

                    <div className="results-details-panel__body">
                      <div className="results-sources">
                        <SourceReviewPanel
                          eyebrow="Source materials"
                          title="IEP source"
                          description="These are the details the app is allowed to cite when it maps accommodations to the task."
                          source={iepSource}
                        />
                        <SourceReviewPanel
                          eyebrow="Source materials"
                          title="Assignment source"
                          description="These are the task details the app uses to explain why a listed accommodation may matter here."
                          source={taskSource}
                        />
                      </div>
                    </div>
                  </details>
                </SectionCard>
              ) : null}

              <SectionCard
                eyebrow="Need to adjust the route?"
                title="Update the source details"
                description="If the result needs work, reopen either source trail here and regenerate from the corrected version."
                icon={<AppIcon name="waypoint" />}
              >
                <div className="results-header">
                  <div className="results-header__actions">
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => syncCorrectionDrafts('iep')}
                    >
                      <AppIcon name="notebook" className="button-icon" />
                      Correct IEP details
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => syncCorrectionDrafts('assignment')}
                    >
                      <AppIcon name="assignment" className="button-icon" />
                      Correct assignment details
                    </button>
                  </div>
                </div>
              </SectionCard>
            </>
          ) : null}
        </main>

        {screen !== 'iep' ? (
          <aside className="app-trust-note">
            <div className="app-trust-note__header">
              <span className="eyebrow eyebrow--hero">
                <AppIcon name="shield" className="button-icon button-icon--sm" />
                Trust note
              </span>
              <h2 className="app-trust-note__title">Grounded boundaries</h2>
            </div>

            <ul className="trust-list trust-list--compact">
              {TRUST_BOUNDARIES.map((boundary) => (
                <li key={boundary.title} className="trust-list__item">
                  <span className="trust-list__icon" aria-hidden="true">
                    <AppIcon name={boundary.icon} />
                  </span>
                  <div>
                    <strong>{boundary.title}</strong>
                    <p>{boundary.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
