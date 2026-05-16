import { useEffect, useRef, useState } from 'react'
import './App.css'
import { AppIcon, type AppIconName } from './components/AppIcon'
import { LoadingIndicator } from './components/LoadingIndicator'
import { SectionCard } from './components/SectionCard'
import BrowserGemmaApp from './features/on-device/BrowserGemmaApp'
import { ProductionLaunchGate } from './features/on-device/ProductionLaunchGate'
import {
  createJordanDemoSources,
  getJordanDemoAccommodationCorrection,
  JORDAN_DEMO_EXAMPLE_ID,
} from './data/demoCase.ts'
import { exampleScenarios } from './data/examples'
import { TaskSetupFields } from './features/input/TaskSetupFields'
import { ResultsView } from './features/results/ResultsView'
import { SourceEditor } from './features/source/SourceEditor'
import {
  clearPersistedIepSource,
  hasPersistedIepSource,
  loadPersistedIepDetails,
  persistIepSource,
} from './features/source/localSourceStorage'
import { SourceReviewPanel } from './features/source/SourceReviewPanel'
import {
  addMissingSourceTextBlock,
  buildEffectiveSourceText,
  getAttachmentSourceText,
  getAttachmentPreviousSourceText,
  getPrimaryTaskTraits,
  hasUsableSourceText,
  normalizeDocumentDraft,
  replaceSourceTextBlock,
} from './features/source/sourceText'
import {
  type GemmaReadingProgressUpdate,
  readGemmaDocumentPlan,
  runGemmaDocumentReading,
  runGemmaIepTextReading,
} from './features/upload/gemmaOcr'
import {
  createUploadedAttachment,
  formatElapsedTime,
  loadLocalTextAttachment,
  refreshAttachmentNotes,
  revokeAttachmentPreview,
} from './features/upload/fileUtils'
import { createAnalysisAdapter } from './lib/analysis'
import { hasUncertaintyMarkers } from './lib/text/uncertaintyMarkers'
import type {
  AnalysisExecution,
  AttachmentInterpretationProgress,
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

function logUploadInterpretationStage(
  stage: string,
  details: Record<string, unknown> = {},
) {
  console.debug('[IEP Compass upload interpretation]', stage, details)
}

function warnUploadInterpretationStage(
  stage: string,
  details: Record<string, unknown> = {},
) {
  console.warn('[IEP Compass upload interpretation]', stage, details)
}

const HERO_GUIDEPOINTS: Array<{ icon: AppIconName; text: string }> = [
  { icon: 'notebook', text: 'Add the part of your IEP that lists your supports, like extra time.' },
  { icon: 'assignment', text: 'Add the school work next. Add the assignment, not your answers.' },
  { icon: 'results', text: 'See which supports fit, what to say, and what to check with a teacher.' },
]

const STEP_CONFIG: Array<{
  helper: string
  icon: AppIconName
  id: Screen
  label: string
}> = [
  {
    id: 'iep',
    label: 'Add your IEP',
    helper: 'What your IEP says you get',
    icon: 'compass',
  },
  {
    id: 'assignment',
    label: 'Add the school work',
    helper: 'The assignment, quiz, or worksheet',
    icon: 'assignment',
  },
  {
    id: 'results',
    label: 'See what helps',
    helper: 'Which supports fit this work',
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
    title: 'Only your real supports',
    detail: 'We only point to supports we can see in the IEP wording you add. We never make up new ones.',
  },
  {
    icon: 'waypoint',
    title: 'We never do your work',
    detail: 'IEP Compass helps you get your supports. It never answers the assignment for you.',
  },
  {
    icon: 'source',
    title: 'Your files stay with you',
    detail: 'What you add stays on your device while you use the app. Nothing is shared on its own.',
  },
]

const TEACHER_CONCERN_VERDICT_LABELS: Record<
  TeacherConcernExecution['result']['verdict'],
  string
> = {
  mixed_needs_context: 'Worth asking a teacher',
  supports_accommodation: 'Your support likely fits',
  supports_teacher_concern: 'The teacher may have a point',
}

function createBlankSource(): SourceMaterial {
  return {
    attachments: [],
    text: '',
  }
}

function getRestoredIepDetails() {
  const restoredDetails = loadPersistedIepDetails()

  return {
    learningProfile: restoredDetails?.learningProfile ?? '',
    source: restoredDetails?.source ?? createBlankSource(),
  }
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

function buildRunningInterpretationProgress(
  update: GemmaReadingProgressUpdate,
  startedAt: number,
  currentProgress?: AttachmentInterpretationProgress,
): AttachmentInterpretationProgress {
  return {
    detail: update.detail,
    label: update.label,
    phase: update.phase,
    startedAt: currentProgress?.startedAt ?? startedAt,
    stepIndex: update.stepIndex,
    stepTotal: update.stepTotal,
    updatedAt: Date.now(),
  }
}

function buildCompletedInterpretationProgress(
  startedAt: number,
  currentProgress: AttachmentInterpretationProgress | undefined,
  options: {
    failed?: boolean
  } = {},
): AttachmentInterpretationProgress {
  const finishedAt = Date.now()
  const effectiveStartedAt = currentProgress?.startedAt ?? startedAt
  const elapsedMs = finishedAt - effectiveStartedAt

  return {
    detail: options.failed
      ? `Stopped after ${formatElapsedTime(elapsedMs)}.`
      : `Finished in ${formatElapsedTime(elapsedMs)}.`,
    elapsedMs,
    finishedAt,
    label: options.failed ? 'Gemma interpretation stopped' : 'Gemma interpretation finished',
    phase: 'complete',
    startedAt: effectiveStartedAt,
    stepIndex: currentProgress?.stepTotal,
    stepTotal: currentProgress?.stepTotal,
    updatedAt: finishedAt,
  }
}

function deriveTaskTitleFromSource(source: SourceMaterial) {
  const taskTraits =
    getPrimaryTaskTraits(source)
    ?? source.attachments
      .map((attachment) => attachment.documentDraft)
      .find((draft): draft is TaskReviewDraft =>
        Boolean(draft && 'taskDescription' in draft),
      )

  if (!taskTraits?.taskDescription.trim()) {
    return ''
  }

  return taskTraits.taskDescription
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^(task summary|document kind|title)\s*:\s*/i, '')
    .slice(0, 96)
    ?? ''
}

function shouldUseReviewReadyTaskAttachment(attachment: UploadedAttachment) {
  return (
    attachment.status === 'review_ready'
    && attachment.documentKind === 'assignment_or_quiz'
    && Boolean(
      attachment.documentDraft
      && 'taskDescription' in attachment.documentDraft
      && attachment.documentDraft.sourceSummaryText?.trim(),
    )
  )
}

function hasUsableTaskSourceForGeneration(source: SourceMaterial) {
  return (
    hasUsableSourceText(source)
    || source.attachments.some(shouldUseReviewReadyTaskAttachment)
  )
}

function includeReviewReadyTaskAttachments(source: SourceMaterial): SourceMaterial {
  return {
    ...source,
    attachments: source.attachments.map((attachment) => {
      if (!shouldUseReviewReadyTaskAttachment(attachment)) {
        return attachment
      }

      return refreshAttachmentNotes({
        ...attachment,
        sourceTrailText: attachment.documentDraft?.sourceSummaryText?.trim(),
        status: 'included',
      })
    }),
  }
}

function IepCompassApp() {
  const [analysisAdapter] = useState(() => createAnalysisAdapter())
  const initialIepDetailsRef = useRef<ReturnType<typeof getRestoredIepDetails> | null>(
    null,
  )
  if (!initialIepDetailsRef.current) {
    initialIepDetailsRef.current = getRestoredIepDetails()
  }

  const [screen, setScreen] = useState<Screen>(() =>
    hasUsableSourceText(initialIepDetailsRef.current?.source ?? createBlankSource())
      ? 'assignment'
      : 'iep',
  )
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null)
  const [contextTags, setContextTags] = useState<TaskContext[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [learningProfile, setLearningProfile] = useState(
    () => initialIepDetailsRef.current?.learningProfile ?? '',
  )
  const [teacherConcern, setTeacherConcern] = useState('')
  const [hasSavedIepOnDevice, setHasSavedIepOnDevice] = useState(() =>
    hasPersistedIepSource(),
  )
  const [shouldPersistIepSource, setShouldPersistIepSource] = useState(true)
  const [iepSource, setIepSource] = useState<SourceMaterial>(
    () => initialIepDetailsRef.current?.source ?? createBlankSource(),
  )
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
  const correctionIepRef = useRef<HTMLDivElement>(null)
  const correctionAssignmentRef = useRef<HTMLDivElement>(null)
  const teacherConcernPanelRef = useRef<HTMLDivElement>(null)

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

    setHasSavedIepOnDevice(persistIepSource(iepSource, learningProfile))
  }, [iepSource, learningProfile, shouldPersistIepSource])

  useEffect(() => {
    if (!correctionTarget) {
      return
    }

    window.requestAnimationFrame(() => {
      const targetElement =
        correctionTarget === 'iep'
          ? correctionIepRef.current
          : correctionAssignmentRef.current

      targetElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      const firstEditable = targetElement?.querySelector<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('textarea:not([disabled]), input:not([type="file"]):not([disabled]), select:not([disabled])')
      firstEditable?.focus({ preventScroll: true })
    })
  }, [correctionTarget])

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

  function updateMainLearningProfile(nextValue: string) {
    setLearningProfile(nextValue)
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

  function applyJordanDemoAccommodationCorrection(attachmentId: string) {
    const correction = getJordanDemoAccommodationCorrection(attachmentId)

    if (!correction) {
      return
    }

    patchMainAttachment(
      'iep',
      attachmentId,
      (current) =>
        refreshAttachmentNotes({
          ...current,
          confidenceFlags: undefined,
          demoCorrectionSource: 'jordan_accommodation_actual',
          documentDraft: undefined,
          documentKind: 'iep_accommodations',
          extractedText: correction.correctedText,
          manualEditSummary: correction.manualEditSummary,
          pageCount: undefined,
          processedPageCount: undefined,
          rawDemoOutput:
            current.rawDemoOutput
            ?? current.extractedText
            ?? current.rawTranscript
            ?? current.readError,
          rawTranscript: undefined,
          readContainsUnclearText: false,
          readError: undefined,
          readNotes: [
            ...(current.readNotes ?? []),
            'Demo correction inserted confirmed text from the synthetic Jordan accommodation snapshot.',
          ],
          reviewedText: undefined,
          sourceTrailText: undefined,
          status: 'review_ready' as const,
        }),
      false,
    )
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

    logUploadInterpretationStage('analysis_started', {
      attachmentKind: attachment.kind,
      sourceKey,
      surface: 'main',
    })

    const startedAt = Date.now()
    const patchProgress = (update: GemmaReadingProgressUpdate) => {
      patchMainAttachment(
        sourceKey,
        attachmentId,
        (current) =>
          refreshAttachmentNotes({
            ...current,
            interpretationProgress: buildRunningInterpretationProgress(
              update,
              startedAt,
              current.interpretationProgress,
            ),
          }),
        false,
      )
    }

    patchMainAttachment(sourceKey, attachmentId, (current) =>
      refreshAttachmentNotes({
        ...current,
        interpretationProgress: buildRunningInterpretationProgress(
          {
            detail: 'Checking the available Gemma document-reading path before reading the upload.',
            label: 'Getting Gemma ready',
            phase: 'checking_model',
            stepIndex: 1,
          },
          startedAt,
          current.interpretationProgress,
        ),
        demoCorrectionSource: undefined,
        manualEditSummary: undefined,
        rawDemoOutput: undefined,
        readError: undefined,
        readNotes: [],
        status: 'interpret_running',
      }),
    )

    try {
      if (sourceKey === 'iep') {
        const readingResult = await runGemmaIepTextReading(attachment, patchProgress)

        logUploadInterpretationStage('client_received_result', {
          extractedChars: readingResult.extractedText.length,
          readMethod: readingResult.readMethod,
          sourceKey,
          surface: 'main',
        })

        patchMainAttachment(
          sourceKey,
          attachmentId,
          (current) =>
            refreshAttachmentNotes({
              ...current,
              confidenceFlags: undefined,
              demoCorrectionSource: undefined,
              documentDraft: undefined,
              documentKind: 'iep_accommodations',
              extractedText: readingResult.extractedText,
              manualEditSummary: undefined,
              rawTranscript: undefined,
              rawDemoOutput: undefined,
              readContainsUnclearText: hasUncertaintyMarkers(readingResult.extractedText),
              readError: undefined,
              readMethod: readingResult.readMethod,
              readNotes: [
                `Interpreted with ${readingResult.modelLabel} via ${readingResult.runtimeLabel}.`,
                'Review this extracted accommodations text before adding it to the source trail.',
              ],
              interpretationProgress: buildCompletedInterpretationProgress(
                startedAt,
                current.interpretationProgress,
              ),
              pageCount: readingResult.pageCount,
              processedPageCount: readingResult.processedPageCount,
              reviewedText: undefined,
              status: 'review_ready',
            }),
          false,
        )

        logUploadInterpretationStage('client_render_state_updated', {
          hasExtractedText: readingResult.extractedText.trim().length > 0,
          nextStatus: 'review_ready',
          sourceKey,
          surface: 'main',
        })

        return
      }

      const readingResult = await runGemmaDocumentReading(
        attachment,
        sourceKey,
        patchProgress,
      )

      logUploadInterpretationStage('client_received_result', {
        documentKind: readingResult.documentResult.documentKind,
        readMethod: readingResult.readMethod,
        reviewDraftKeys: Object.keys(readingResult.documentResult.reviewDraft),
        sourceKey,
        surface: 'main',
      })

      patchMainAttachment(
        sourceKey,
        attachmentId,
        (current) =>
          refreshAttachmentNotes({
            ...current,
            confidenceFlags: readingResult.documentResult.confidenceFlags,
            demoCorrectionSource: undefined,
            documentDraft: normalizeDocumentDraft(
              readingResult.documentResult.reviewDraft,
            ),
            documentKind: readingResult.documentResult.documentKind,
            manualEditSummary: undefined,
            rawTranscript: readingResult.documentResult.rawTranscript,
            rawDemoOutput: undefined,
            readContainsUnclearText:
              readingResult.documentResult.confidenceFlags.containsUnclearText,
            readError: undefined,
            readMethod: readingResult.readMethod,
            readNotes: [
              `Interpreted with ${readingResult.modelLabel} via ${readingResult.runtimeLabel}.`,
              ...readingResult.documentResult.notes,
            ],
            interpretationProgress: buildCompletedInterpretationProgress(
              startedAt,
              current.interpretationProgress,
            ),
            pageCount: readingResult.pageCount,
            processedPageCount: readingResult.processedPageCount,
            reviewedText: undefined,
            status: 'review_ready',
          }),
        false,
      )

      logUploadInterpretationStage('client_render_state_updated', {
        documentKind: readingResult.documentResult.documentKind,
        nextStatus: 'review_ready',
        sourceKey,
        surface: 'main',
      })
    } catch (error) {
      warnUploadInterpretationStage('analysis_failed', {
        error: error instanceof Error ? error.message : String(error),
        sourceKey,
        surface: 'main',
      })
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
            interpretationProgress: buildCompletedInterpretationProgress(
              startedAt,
              current.interpretationProgress,
              { failed: true },
            ),
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

    logUploadInterpretationStage('analysis_started', {
      attachmentKind: attachment.kind,
      sourceKey,
      surface: 'correction',
    })

    const startedAt = Date.now()
    const patchProgress = (update: GemmaReadingProgressUpdate) => {
      patchCorrectionAttachment(sourceKey, attachmentId, (current) =>
        refreshAttachmentNotes({
          ...current,
          interpretationProgress: buildRunningInterpretationProgress(
            update,
            startedAt,
            current.interpretationProgress,
          ),
        }),
      )
    }

    patchCorrectionAttachment(sourceKey, attachmentId, (current) =>
      refreshAttachmentNotes({
        ...current,
        interpretationProgress: buildRunningInterpretationProgress(
          {
            detail: 'Checking the available Gemma document-reading path before reading the upload.',
            label: 'Getting Gemma ready',
            phase: 'checking_model',
            stepIndex: 1,
          },
          startedAt,
          current.interpretationProgress,
        ),
        readError: undefined,
        readNotes: [],
        status: 'interpret_running',
      }),
    )

    try {
      if (sourceKey === 'iep') {
        const readingResult = await runGemmaIepTextReading(attachment, patchProgress)

        logUploadInterpretationStage('client_received_result', {
          extractedChars: readingResult.extractedText.length,
          readMethod: readingResult.readMethod,
          sourceKey,
          surface: 'correction',
        })

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
            interpretationProgress: buildCompletedInterpretationProgress(
              startedAt,
              current.interpretationProgress,
            ),
            pageCount: readingResult.pageCount,
            processedPageCount: readingResult.processedPageCount,
            reviewedText: undefined,
            status: 'review_ready',
          }),
        )

        logUploadInterpretationStage('client_render_state_updated', {
          hasExtractedText: readingResult.extractedText.trim().length > 0,
          nextStatus: 'review_ready',
          sourceKey,
          surface: 'correction',
        })

        return
      }

      const readingResult = await runGemmaDocumentReading(
        attachment,
        sourceKey,
        patchProgress,
      )

      logUploadInterpretationStage('client_received_result', {
        documentKind: readingResult.documentResult.documentKind,
        readMethod: readingResult.readMethod,
        reviewDraftKeys: Object.keys(readingResult.documentResult.reviewDraft),
        sourceKey,
        surface: 'correction',
      })

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
          interpretationProgress: buildCompletedInterpretationProgress(
            startedAt,
            current.interpretationProgress,
          ),
          pageCount: readingResult.pageCount,
          processedPageCount: readingResult.processedPageCount,
          reviewedText: undefined,
          status: 'review_ready',
        }),
      )

      logUploadInterpretationStage('client_render_state_updated', {
        documentKind: readingResult.documentResult.documentKind,
        nextStatus: 'review_ready',
        sourceKey,
        surface: 'correction',
      })
    } catch (error) {
      warnUploadInterpretationStage('analysis_failed', {
        error: error instanceof Error ? error.message : String(error),
        sourceKey,
        surface: 'correction',
      })
      patchCorrectionAttachment(sourceKey, attachmentId, (current) =>
        refreshAttachmentNotes({
          ...current,
          readError:
            error instanceof Error
              ? error.message
              : 'We could not interpret enough of this file clearly.',
          interpretationProgress: buildCompletedInterpretationProgress(
            startedAt,
            current.interpretationProgress,
            { failed: true },
          ),
          reviewedText: undefined,
          status: 'failed',
        }),
      )
    }
  }

  function applyMainAttachmentTextReview(
    sourceKey: SourceKey,
    attachmentId: string,
    nextValue: string,
    mode: 'add' | 'dismiss' | 'replace',
  ) {
    const reviewedText = nextValue.trim()
    const keepDemoIepEphemeral =
      sourceKey === 'iep' && activeExampleId === JORDAN_DEMO_EXAMPLE_ID

    patchMainAttachment(sourceKey, attachmentId, (attachment) =>
      refreshAttachmentNotes({
        ...attachment,
        reviewedText: mode === 'dismiss' || !reviewedText ? undefined : reviewedText,
        sourceTrailText: undefined,
        status: mode === 'dismiss' || !reviewedText ? 'reference_only' : 'applied_to_text',
      }),
    )

    if (mode === 'dismiss' || !reviewedText) {
      return
    }

    updateMainSource(sourceKey, (current) => ({
      ...current,
      text:
        mode === 'replace'
          ? reviewedText
          : addMissingSourceTextBlock(current.text, reviewedText),
    }))

    if (keepDemoIepEphemeral) {
      setShouldPersistIepSource(false)
    }
  }

  function applyCorrectionAttachmentTextReview(
    sourceKey: SourceKey,
    attachmentId: string,
    nextValue: string,
    mode: 'add' | 'dismiss' | 'replace',
  ) {
    const reviewedText = nextValue.trim()

    patchCorrectionAttachment(sourceKey, attachmentId, (attachment) =>
      refreshAttachmentNotes({
        ...attachment,
        reviewedText: mode === 'dismiss' || !reviewedText ? undefined : reviewedText,
        sourceTrailText: undefined,
        status: mode === 'dismiss' || !reviewedText ? 'reference_only' : 'applied_to_text',
      }),
    )

    if (mode === 'dismiss' || !reviewedText) {
      return
    }

    updateCorrectionSource(sourceKey, (current) => ({
      ...current,
      text:
        mode === 'replace'
          ? reviewedText
          : addMissingSourceTextBlock(current.text, reviewedText),
    }))
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
    let previousSourceText = ''
    let derivedTaskTitle = ''

    patchMainAttachment(sourceKey, attachmentId, (attachment) => {
      previousSourceText = getAttachmentPreviousSourceText(attachment)
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
      if (
        sourceKey === 'task'
        && nextAttachment.status === 'included'
        && nextAttachment.documentDraft
        && 'taskDescription' in nextAttachment.documentDraft
      ) {
        derivedTaskTitle = nextAttachment.documentDraft.taskDescription
          .split('\n')
          .map((line) => line.trim())
          .find(Boolean)
          ?.replace(/^(task summary|document kind|title)\s*:\s*/i, '')
          .slice(0, 96)
          ?? ''
      }
      return {
        ...nextAttachment,
        sourceTrailText: includedSourceText || undefined,
      }
    })

    if (sourceKey === 'iep' && includedSourceText) {
      updateMainSource(sourceKey, (current) => ({
        ...current,
        text: replaceSourceTextBlock(
          current.text,
          previousSourceText,
          includedSourceText,
        ),
      }))
    }

    if (sourceKey === 'task' && !taskTitle.trim() && derivedTaskTitle) {
      setTaskTitle(derivedTaskTitle)
    }

    markMainSourceChanged()
  }

  function includeCorrectionAttachmentSource(
    sourceKey: SourceKey,
    attachmentId: string,
  ) {
    let includedSourceText = ''
    let previousSourceText = ''
    let derivedTaskTitle = ''

    patchCorrectionAttachment(sourceKey, attachmentId, (attachment) => {
      previousSourceText = getAttachmentPreviousSourceText(attachment)
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
      if (
        sourceKey === 'task'
        && nextAttachment.status === 'included'
        && nextAttachment.documentDraft
        && 'taskDescription' in nextAttachment.documentDraft
      ) {
        derivedTaskTitle = nextAttachment.documentDraft.taskDescription
          .split('\n')
          .map((line) => line.trim())
          .find(Boolean)
          ?.replace(/^(task summary|document kind|title)\s*:\s*/i, '')
          .slice(0, 96)
          ?? ''
      }
      return {
        ...nextAttachment,
        sourceTrailText: includedSourceText || undefined,
      }
    })

    if (sourceKey === 'iep' && includedSourceText) {
      updateCorrectionSource(sourceKey, (current) => ({
        ...current,
        text: replaceSourceTextBlock(
          current.text,
          previousSourceText,
          includedSourceText,
        ),
      }))
    }

    if (sourceKey === 'task' && !correctionTaskTitle.trim() && derivedTaskTitle) {
      setCorrectionTaskTitle(derivedTaskTitle)
    }
  }

  function keepMainAttachmentReference(sourceKey: SourceKey, attachmentId: string) {
    let previousSourceText = ''
    let wasIncluded = false

    patchMainAttachment(sourceKey, attachmentId, (attachment) =>
      {
        wasIncluded = attachment.status === 'included'
        previousSourceText = getAttachmentPreviousSourceText(attachment)
        return refreshAttachmentNotes({
          ...attachment,
          reviewedText: undefined,
          sourceTrailText: undefined,
          status: 'reference_only',
        })
      },
    )

    if (sourceKey === 'iep' && wasIncluded && previousSourceText) {
      updateMainSource(sourceKey, (current) => ({
        ...current,
        text: replaceSourceTextBlock(current.text, previousSourceText, ''),
      }))
    }
  }

  function keepCorrectionAttachmentReference(
    sourceKey: SourceKey,
    attachmentId: string,
  ) {
    let previousSourceText = ''
    let wasIncluded = false

    patchCorrectionAttachment(sourceKey, attachmentId, (attachment) =>
      {
        wasIncluded = attachment.status === 'included'
        previousSourceText = getAttachmentPreviousSourceText(attachment)
        return refreshAttachmentNotes({
          ...attachment,
          reviewedText: undefined,
          sourceTrailText: undefined,
          status: 'reference_only',
        })
      },
    )

    if (sourceKey === 'iep' && wasIncluded && previousSourceText) {
      updateCorrectionSource(sourceKey, (current) => ({
        ...current,
        text: replaceSourceTextBlock(current.text, previousSourceText, ''),
      }))
    }
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

  async function applyExample(exampleId: string) {
    const nextExample = exampleScenarios.find((example) => example.id === exampleId)

    if (!nextExample) {
      return
    }

    if (nextExample.id === JORDAN_DEMO_EXAMPLE_ID) {
      const demoSources = await createJordanDemoSources()

      replaceIepSource(demoSources.iepSource, { persist: false })
      replaceTaskSource(demoSources.taskSource)
      cancelPendingAnalysis()
      setActiveExampleId(nextExample.id)
      setContextTags(demoSources.contextTags)
      setTaskTitle(demoSources.taskTitle)
      setLearningProfile(demoSources.learningProfile)
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
      setCorrectionTaskTitle(demoSources.taskTitle)
      setCorrectionTeacherConcern(nextExample.teacherConcern ?? '')
      setCorrectionContextTags(demoSources.contextTags)
      setCorrectionTarget(null)
      setScreen('iep')
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
    setLearningProfile('')
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
    const restoredIepDetails = getRestoredIepDetails()

    cancelPendingAnalysis()
    replaceIepSource(restoredIepDetails.source)
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
    setLearningProfile(restoredIepDetails.learningProfile)
    setTeacherConcern('')
    setActiveExampleId(null)
    setAnalysis(null)
    setAnalysisError(null)
    setCorrectionTaskTitle('')
    setCorrectionTeacherConcern('')
    setCorrectionContextTags([])
    setCorrectionTarget(null)
    setScreen(hasUsableSourceText(restoredIepDetails.source) ? 'assignment' : 'iep')
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
    if (!hasUsableSourceText(iepSource) || !hasUsableTaskSourceForGeneration(taskSource)) {
      return
    }

    const nextTaskSource = includeReviewReadyTaskAttachments(taskSource)
    const nextTaskTitle = taskTitle.trim() || deriveTaskTitleFromSource(nextTaskSource)

    if (!nextTaskTitle) {
      return
    }

    if (nextTaskSource !== taskSource) {
      replaceTaskSource(nextTaskSource)
    }

    if (!taskTitle.trim()) {
      setTaskTitle(nextTaskTitle)
    }

    const didGenerate = await runPrimaryAnalysis(
      iepSource,
      nextTaskSource,
      nextTaskTitle,
      learningProfile,
      contextTags,
    )
    if (!didGenerate) {
      return
    }
  }

  async function handleRegenerateFromCorrection() {
    const nextIepSource = correctionIepSource
    const nextTaskSource = includeReviewReadyTaskAttachments(correctionTaskSource)
    const nextTaskTitle =
      correctionTaskTitle.trim() || deriveTaskTitleFromSource(nextTaskSource)
    const nextLearningProfile = learningProfile
    const nextTeacherConcern = correctionTeacherConcern
    const nextContextTags = correctionContextTags

    if (!nextTaskTitle) {
      return
    }

    if (nextTaskSource !== correctionTaskSource) {
      setCorrectionTaskSource(nextTaskSource)
    }

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

    const nextTaskSource = includeReviewReadyTaskAttachments(taskSource)

    if (nextTaskSource !== taskSource) {
      replaceTaskSource(nextTaskSource)
    }

    await runTeacherConcernFollowUp(
      buildTeacherConcernRequest(
        iepSource,
        nextTaskSource,
        effectiveTaskTitle,
        learningProfile,
        teacherConcern,
        contextTags,
      ),
    )
  }

  function askAboutSkippedAccommodation(
    item: AnalysisExecution['result']['notObviouslyRelevant'][number],
  ) {
    updateMainTeacherConcern(
      `Can we check why my approved accommodation "${item.name}" might not fit this task yet? ${item.reason}`,
    )

    window.requestAnimationFrame(() => {
      teacherConcernPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      teacherConcernPanelRef.current
        ?.querySelector<HTMLTextAreaElement>('textarea[name="resultsTeacherConcern"]')
        ?.focus({ preventScroll: true })
    })
  }

  function clearSavedIepFromDevice() {
    clearPersistedIepSource()
    setHasSavedIepOnDevice(false)
    cancelPendingAnalysis()
    replaceIepSource(createBlankSource())
    setLearningProfile('')
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
  const effectiveTaskTitle = taskTitle.trim() || deriveTaskTitleFromSource(taskSource)
  const effectiveCorrectionTaskTitle =
    correctionTaskTitle.trim() || deriveTaskTitleFromSource(correctionTaskSource)
  const interpretedTaskTitle = !taskTitle.trim()
    ? deriveTaskTitleFromSource(taskSource)
    : ''
  const canGenerateOutput =
    hasUsableSourceText(iepSource) &&
    hasUsableTaskSourceForGeneration(taskSource) &&
    Boolean(effectiveTaskTitle)
  const generateDisabledReason = !hasUsableSourceText(iepSource)
    ? 'Go back to step 1 and add your IEP supports first.'
    : !hasUsableTaskSourceForGeneration(taskSource)
      ? 'Add the directions for the school work above.'
      : !effectiveTaskTitle
        ? 'Add a short title for the school work above.'
        : isAnalyzing
          ? 'We are already checking this. One moment.'
          : undefined
  const canAddressTeacherConcern =
    !isAnalyzing &&
    hasUsableSourceText(iepSource) &&
    hasUsableTaskSourceForGeneration(taskSource) &&
    Boolean(effectiveTaskTitle) &&
    Boolean(teacherConcern.trim())
  const canRegenerateFromCorrection =
    hasUsableSourceText(correctionIepSource) &&
    hasUsableTaskSourceForGeneration(correctionTaskSource) &&
    Boolean(effectiveCorrectionTaskTitle)
  const canNavigateToResults = Boolean(analysis || analysisError || isAnalyzing)
  const canNavigateToStep = (stepId: Screen) => {
    if (stepId === 'iep') {
      return true
    }

    if (stepId === 'assignment') {
      return canContinueToAssignment
    }

    return canNavigateToResults
  }
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
                  Made for your phone
                </span>
                <span className="hero-mini-badge">
                  <AppIcon name="star" className="button-icon button-icon--sm" />
                  Here to help you
                </span>
              </div>

              <div className="app-header__main">
                <div className="app-header__headline">
                  <h1>IEP Compass</h1>
                  <p className="app-header__lede">
                    First, add your IEP. Then add your school work. We will show
                    you which of your supports fit, what you can say, and what to
                    check with a teacher.
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
                    Start with your IEP
                  </div>
                  <div className="hero-compass-card__note hero-compass-card__note--bottom">
                    <AppIcon name="results" className="button-icon button-icon--sm" />
                    Follow the three steps
                  </div>
                </div>
              </div>

              <div className="hero-trust-strip" aria-label="How we keep this safe">
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
                  Step-by-step support helper
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

        <nav className="progress-strip" aria-label="Your progress">
          {STEP_CONFIG.map((step, index) => {
            const isActive = screen === step.id
            const isComplete =
              (step.id === 'iep' && (screen === 'assignment' || screen === 'results')) ||
              (step.id === 'assignment' && screen === 'results')
            const stepStatus = isComplete
              ? 'Done'
              : isActive
                ? 'You are here'
                : 'Coming up'
            const canNavigate = canNavigateToStep(step.id)
            const lockedHint =
              step.id === 'assignment'
                ? 'Finish step 1 first'
                : step.id === 'results'
                  ? 'Finish step 2 first'
                  : ''

            return (
              <button
                key={step.id}
                aria-current={isActive ? 'step' : undefined}
                aria-disabled={!canNavigate}
                className={`progress-step progress-step--${step.id}${
                  isActive ? ' progress-step--active' : ''
                }${isComplete ? ' progress-step--complete' : ''}${
                  canNavigate ? '' : ' progress-step--locked'
                }`}
                disabled={!canNavigate}
                title={!canNavigate ? lockedHint : undefined}
                type="button"
                onClick={() => setScreen(step.id)}
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
                  <p>{!canNavigate && lockedHint ? lockedHint : step.helper}</p>
                </div>
              </button>
            )
          })}
        </nav>

        <main className="screen-stack">
          {screen === 'iep' ? (
            <>
              <SectionCard
                eyebrow="Step 1"
                title="Add what your IEP gives you"
                description="Your IEP lists supports your school agreed to, like extra time. Copy in that part of your IEP. You can add a photo or file instead if that is easier."
                icon={<AppIcon name="notebook" />}
                footer={
                  <div className="screen-actions screen-actions--stacked">
                    {!canContinueToAssignment ? (
                      <p className="field-message field-message--hint">
                        <AppIcon name="flag" className="button-icon button-icon--sm" />
                        Add at least one IEP support above to keep going.
                      </p>
                    ) : null}
                    <button
                      className="action-button"
                      type="button"
                      disabled={!canContinueToAssignment}
                      onClick={() => setScreen('assignment')}
                    >
                      <AppIcon name="assignment" className="button-icon" />
                      Next: add the school work
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
                            ? 'This is just an example'
                            : hasSavedIepOnDevice
                            ? 'Saved on this device'
                            : 'Saved only on this device'}
                        </span>
                        <p className="field-message">
                          {isPreviewingExampleIep
                            ? hasSavedIepOnDevice
                              ? 'This example will not change your saved IEP. Tap Start over to bring your own IEP back. School work and files are not saved.'
                              : 'This example is just for practice and is not saved. School work and files are not saved.'
                            : hasSavedIepOnDevice
                            ? 'Your IEP supports come back the next time you open this app on this device. Type new wording any time to replace them. Files and school work are not saved.'
                            : 'Your IEP supports stay on this device only. Type new wording any time to replace them. Files and school work are not saved.'}
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
                  textHelp="Copy in the supports listed in your IEP, word for word. One support per line is easiest to read."
                  textLabel="Your IEP supports"
                  textRequired
                  textName="iepExcerpt"
                  textPlaceholder={`Example:\n- Extra time on quizzes and tests\n- A quiet space with fewer distractions for tests\n- Directions explained and broken into smaller steps`}
                  textValue={iepSource.text}
                  onApplyAttachmentTextReview={(attachmentId, nextValue, mode) =>
                    applyMainAttachmentTextReview('iep', attachmentId, nextValue, mode)
                  }
                  onAttachmentDocumentDraftChange={(attachmentId, nextDraft) =>
                    updateMainAttachmentDocumentDraft('iep', attachmentId, nextDraft)
                  }
                  onKeepAttachmentReference={(attachmentId) =>
                    keepMainAttachmentReference('iep', attachmentId)
                  }
                  onApplyDemoAccommodationCorrection={
                    applyJordanDemoAccommodationCorrection
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
                  uploadEmptyBadge="Try this first"
                  uploadGuidance="You can add a photo, screenshot, PDF, or text file of your IEP. After you check it, the details can be used in your results."
                  uploadSummaryTitle="Add a photo or file"
                  uploadsFirst
                  emptyState="No files yet. You can skip this if typing is easier."
                  textFootnote={
                    !canContinueToAssignment ? (
                      <p className="field-message field-message--hint">
                        Add at least one IEP support to move on. A checked photo or
                        file also counts.
                      </p>
                    ) : null
                  }
                />

                <label className="textarea-label">
                  <span className="field-label__title">
                    How you learn best (optional)
                  </span>
                  <textarea
                    className="textarea-input textarea-input--compact"
                    name="learningProfile"
                    placeholder="Example: I have dyslexia, so reading long passages takes me longer."
                    value={learningProfile}
                    onChange={(event) =>
                      updateMainLearningProfile(event.target.value)
                    }
                  />
                  <span className="field-label__help">
                    You can skip this. It only helps us explain things. Your
                    supports still come from the IEP wording above.
                  </span>
                </label>
                <details className="optional-panel" open>
                  <summary className="optional-panel__summary">
                    <span className="summary-label">
                      <AppIcon name="spark" className="button-icon button-icon--sm" />
                      Want to try an example first?
                    </span>
                    <span className="meta-badge">Optional</span>
                  </summary>

                  <div className="optional-panel__body">
                    <p className="field-message">
                      Tap an example to fill it in for you. The Jordan M. example
                      uses sample photos: read the IEP photo, fix anything that
                      looks off, read the school work photo, then see what helps.
                      The other examples are typed in for you.
                    </p>

                    <div className="example-grid">
                      {exampleScenarios.map((example) => {
                        const isActive = example.id === activeExampleId
                        const isSeededDemo = example.id === JORDAN_DEMO_EXAMPLE_ID

                        return (
                          <button
                            key={example.id}
                            className={`example-card${
                              isActive ? ' example-card--active' : ''
                            }${isSeededDemo ? ' example-card--demo' : ''}`}
                            type="button"
                            onClick={() => {
                              void applyExample(example.id)
                            }}
                          >
                            <div>
                              {isSeededDemo ? (
                                <span className="example-card__badge">
                                  <AppIcon name="star" className="button-icon button-icon--sm" />
                                  Example with photos
                                </span>
                              ) : null}
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
                eyebrow="Step 2"
                title="Add the school work"
                description="Add a short title and the directions for the assignment, quiz, or worksheet. The extras at the bottom are optional."
                icon={<AppIcon name="assignment" />}
                footer={
                  <div className="screen-actions screen-actions--stacked">
                    {generateDisabledReason && !isAnalyzing ? (
                      <p className="field-message field-message--hint">
                        <AppIcon name="flag" className="button-icon button-icon--sm" />
                        {generateDisabledReason}
                      </p>
                    ) : null}
                    <div className="screen-actions screen-actions--split">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setScreen('iep')}
                      >
                        <AppIcon name="notebook" className="button-icon" />
                        Back to my IEP
                      </button>

                      <button
                        className="action-button"
                        type="button"
                        disabled={!canGenerateOutput || isAnalyzing}
                        onClick={() => void handleGenerateOutput()}
                      >
                        {isAnalyzing ? (
                          <LoadingIndicator label="Working on it" size="sm" />
                        ) : (
                          <>
                            <AppIcon name="results" className="button-icon" />
                            See what helps
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                }
              >
                <div className="field-label">
                  <span className="field-label__title">
                    Name of the school work
                    <span className="field-required-pill">Needed</span>
                  </span>
                  <p className="field-label__help">
                    A few words so you can spot it later.
                  </p>
                  {interpretedTaskTitle ? (
                    <div className="inline-suggestion">
                      <span>We found a name: {interpretedTaskTitle}</span>
                      <button
                        className="text-link-button"
                        type="button"
                        onClick={() => {
                          setTaskTitle(interpretedTaskTitle)
                          setActiveExampleId(null)
                          setAnalysisError(null)
                          clearTeacherConcernState()
                        }}
                      >
                        Use this name
                      </button>
                    </div>
                  ) : null}
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
                  textHelp="Copy in the directions, or say what the work asks you to do. Add the directions, not your answers."
                  textLabel="What the school work asks you to do"
                  textRequired
                  textName="taskText"
                  textPlaceholder="Copy in the directions, describe what the work asks, or add a photo or file of it."
                  textValue={taskSource.text}
                  onApplyAttachmentTextReview={(attachmentId, nextValue, mode) =>
                    applyMainAttachmentTextReview('task', attachmentId, nextValue, mode)
                  }
                  onAttachmentDocumentDraftChange={(attachmentId, nextDraft) =>
                    updateMainAttachmentDocumentDraft('task', attachmentId, nextDraft)
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
                  uploadGuidance="You can add a photo, screenshot, PDF, or text file of the school work. We will read it and let you check it before using it."
                  emptyState="No files yet. You can skip this if you already typed the directions."
                />

                <details className="optional-panel" open={showOptionalTaskSetup}>
                  <summary className="optional-panel__summary">
                    <span className="summary-label">
                      <AppIcon name="waypoint" className="button-icon button-icon--sm" />
                      Extra info (optional)
                    </span>
                    <span className="meta-badge">
                      {showOptionalTaskSetup ? 'Added' : 'You can skip this'}
                    </span>
                  </summary>

                  <div className="optional-panel__body">
                    <label className="textarea-label">
                      <span className="field-label__title">
                        A question for a teacher (optional)
                      </span>
                      <textarea
                        className="textarea-input textarea-input--compact"
                        name="teacherConcern"
                        placeholder="Example: Will spelling mistakes lower my grade a lot on this essay?"
                        value={teacherConcern}
                        onChange={(event) => {
                          updateMainTeacherConcern(event.target.value)
                          setActiveExampleId(null)
                          setAnalysisError(null)
                        }}
                      />
                      <span className="field-label__help">
                        Have one question about this work? Add it and we will
                        help you think it through after your results.
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
                    {import.meta.env.PROD ? (
                      <p className="field-message">
                        Production already checks Wi-Fi, loads the browser model,
                        and confirms Gemma is ready before the app opens.
                      </p>
                    ) : (
                      <BrowserGemmaApp localModelPlan={modelPlan} />
                    )}
                  </div>
                </details>
              </SectionCard>
            </>
          ) : null}

          {screen === 'results' ? (
            <>
              {correctionTarget === 'iep' ? (
                <div ref={correctionIepRef}>
                  <SectionCard
                    eyebrow="Fix details"
                    title="Fix your IEP"
                    description="Change anything we got wrong in your IEP, then see your results again."
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
                            Update my results
                          </>
                        )}
                        </button>
                      </div>
                    }
                  >
                    <SourceEditor
                      attachments={correctionIepSource.attachments}
                      documentPlan={documentPlan}
                      textHelp="Change your IEP supports here if we missed one or got the wording wrong."
                      textLabel="Your IEP supports"
                      textName="correctionIepExcerpt"
                      textPlaceholder={`Example:\n- Extra time on quizzes and tests\n- A quiet space with fewer distractions for tests\n- Directions explained and broken into smaller steps`}
                      textValue={correctionIepSource.text}
                      onApplyAttachmentTextReview={(attachmentId, nextValue, mode) =>
                        applyCorrectionAttachmentTextReview(
                          'iep',
                          attachmentId,
                          nextValue,
                          mode,
                        )
                      }
                      onAttachmentDocumentDraftChange={(attachmentId, nextDraft) =>
                        updateCorrectionAttachmentDocumentDraft('iep', attachmentId, nextDraft)
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
                      uploadEmptyBadge="Try this first"
                      uploadGuidance="Add a photo, screenshot, PDF, or text file if that is an easier way to fix your IEP."
                      uploadSummaryTitle="Add a photo or file"
                      uploadsFirst
                      emptyState="No files added yet."
                    />
                  </SectionCard>
                </div>
              ) : null}

              {correctionTarget === 'assignment' ? (
                <div ref={correctionAssignmentRef}>
                  <SectionCard
                  eyebrow="Fix details"
                  title="Fix the school work"
                  description="Change the directions, tags, or your question, then see your results again."
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
                            Update my results
                          </>
                        )}
                      </button>
                    </div>
                  }
                >
                  <div className="field-label">
                    <span className="field-label__title">Name of the school work</span>
                    <p className="field-label__help">
                      Change the name too if the first one was unclear.
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
                    textHelp="Fix the directions here so your results match what the work really asks you to do."
                    textLabel="What the school work asks you to do"
                    textName="correctionTaskText"
                    textPlaceholder="Copy in the directions, describe what the work asks, or add a photo or file of it."
                    textValue={correctionTaskSource.text}
                    onApplyAttachmentTextReview={(attachmentId, nextValue, mode) =>
                      applyCorrectionAttachmentTextReview(
                        'task',
                        attachmentId,
                        nextValue,
                        mode,
                      )
                    }
                    onAttachmentDocumentDraftChange={(attachmentId, nextDraft) =>
                      updateCorrectionAttachmentDocumentDraft(
                        'task',
                        attachmentId,
                        nextDraft,
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
                    uploadGuidance="Add a clearer photo or file if it helps show the school work better."
                    emptyState="No files added yet."
                  />

                  <details
                    className="optional-panel"
                    open={showCorrectionOptionalTaskSetup}
                  >
                    <summary className="optional-panel__summary">
                      <span className="summary-label">
                        <AppIcon name="waypoint" className="button-icon button-icon--sm" />
                        Extra info (optional)
                      </span>
                      <span className="meta-badge">
                        {showCorrectionOptionalTaskSetup ? 'Added' : 'Optional'}
                      </span>
                    </summary>

                    <div className="optional-panel__body">
                      <label className="textarea-label">
                        <span className="field-label__title">
                          A question for a teacher (optional)
                        </span>
                        <textarea
                          className="textarea-input textarea-input--compact"
                          name="correctionTeacherConcern"
                          placeholder="Example: Will spelling mistakes lower my grade a lot on this essay?"
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
                </div>
              ) : null}

              {isAnalyzing ? (
                <SectionCard
                  eyebrow="Working on it"
                  title="Finding the supports that fit"
                  description="This takes a moment. We are matching your IEP supports to your school work."
                  icon={<AppIcon name="compass" />}
                >
                  <div className="loading-card">
                    <LoadingIndicator label="Matching your supports to the school work" />
                    <p>
                      We are only using the supports you added in step 1.
                    </p>
                  </div>
                </SectionCard>
              ) : null}

              {analysisError ? (
                <SectionCard
                  title="That did not work — let's try again"
                  tone="accent"
                  description={analysisError}
                  icon={<AppIcon name="flag" />}
                >
                  <div className="placeholder-stack">
                    <p>
                      Check your IEP and school work above, fix anything that
                      looks off, then try again.
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
                <ResultsView
                  analysis={analysis}
                  onAskAboutAccommodation={askAboutSkippedAccommodation}
                />
              ) : null}

              {analysis ? (
                <div ref={teacherConcernPanelRef}>
                  <SectionCard
                    eyebrow="Optional"
                    title="Ask one more question"
                    description="Have a question about one of your supports or this school work? We can help you think it through."
                    icon={<AppIcon name="teacher" />}
                  >
                  <details
                    className="optional-panel"
                    open={Boolean(teacherConcern.trim()) || Boolean(teacherConcernAnalysis)}
                  >
                    <summary className="optional-panel__summary">
                      <span className="summary-label">
                        <AppIcon name="quote" className="button-icon button-icon--sm" />
                        Add a question
                      </span>
                      <span className="meta-badge">
                        {teacherConcernAnalysis ? 'Answered' : 'Optional'}
                      </span>
                    </summary>

                    <div className="optional-panel__body teacher-concern-stack">
                      <label className="textarea-label">
                        <span className="field-label__title">Your question</span>
                        <textarea
                          className="textarea-input textarea-input--compact"
                          name="resultsTeacherConcern"
                          placeholder="Example: Does my spelling support fit this essay, or is spelling part of the grade?"
                          value={teacherConcern}
                          onChange={(event) => {
                            updateMainTeacherConcern(event.target.value)
                          }}
                        />
                      </label>

                      <div className="screen-actions screen-actions--split">
                        <p className="review-note">
                          This is separate from your main results, so we can
                          focus on one question at a time.
                        </p>

                        <button
                          className="action-button action-button--secondary"
                          type="button"
                          disabled={!canAddressTeacherConcern || isTeacherConcernAnalyzing}
                          onClick={() => void handleTeacherConcernReview()}
                        >
                          {isTeacherConcernAnalyzing ? (
                            <LoadingIndicator label="Thinking it through" size="sm" />
                          ) : (
                            <>
                              <AppIcon name="quote" className="button-icon" />
                              Help me with this
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
                            <h3>Here's some help</h3>
                            <span className="meta-badge">
                              {
                                TEACHER_CONCERN_VERDICT_LABELS[
                                  teacherConcernAnalysis.result.verdict
                                ]
                              }
                            </span>
                          </div>

                          <div className="results-detail-block">
                            <h3>Your question</h3>
                            <p>{teacherConcernAnalysis.result.concern}</p>
                          </div>

                          <div className="results-detail-block">
                            <h3>What this means</h3>
                            <p>{teacherConcernAnalysis.result.guidance}</p>
                          </div>

                          <div className="results-detail-block">
                            <h3>What you can say</h3>
                            <p>{teacherConcernAnalysis.result.suggestedResponse}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </details>
                  </SectionCard>
                </div>
              ) : null}

              {analysis || analysisError ? (
                <SectionCard
                  eyebrow="Want more detail?"
                  title="See exactly what you added"
                  description="Open this if a result looks off and you want to check what you gave us."
                  icon={<AppIcon name="source" />}
                >
                  <details className="results-details-panel">
                    <summary className="results-details-panel__summary">
                      <span className="summary-label">
                        <AppIcon name="source" className="button-icon button-icon--sm" />
                        Show what I added
                      </span>
                    </summary>

                    <div className="results-details-panel__body">
                      <div className="results-sources">
                        <SourceReviewPanel
                          eyebrow="What you added"
                          title="Your IEP"
                          description="These are the supports we are allowed to point to in your results."
                          source={iepSource}
                        />
                        <SourceReviewPanel
                          eyebrow="What you added"
                          title="Your school work"
                          description="These are the school work details we use to explain why a support may help."
                          source={taskSource}
                        />
                      </div>
                    </div>
                  </details>
                </SectionCard>
              ) : null}

              <SectionCard
                eyebrow="Need to change something?"
                title="Fix your details"
                description="If a result looks wrong, fix your IEP or school work here, then see your results again."
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
                      Fix my IEP
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => syncCorrectionDrafts('assignment')}
                    >
                      <AppIcon name="assignment" className="button-icon" />
                      Fix the school work
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
                Good to know
              </span>
              <h2 className="app-trust-note__title">How we keep this safe</h2>
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

export default function App() {
  return (
    <ProductionLaunchGate enabled={import.meta.env.PROD}>
      <IepCompassApp />
    </ProductionLaunchGate>
  )
}
