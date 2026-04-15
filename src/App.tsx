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
import { SourceReviewPanel } from './features/source/SourceReviewPanel'
import {
  buildEffectiveSourceText,
  hasUsableSourceText,
} from './features/source/sourceText'
import {
  revokeAttachmentPreview,
  toUploadedAttachment,
} from './features/upload/fileUtils'
import { createAnalysisAdapter } from './lib/analysis'
import type {
  AnalysisExecution,
  Role,
  SourceMaterial,
  TaskContext,
  TeacherConcernExecution,
  TeacherConcernRequest,
  UploadedAttachment,
} from './types/analysis'

type Screen = 'iep' | 'assignment' | 'results'
type CorrectionTarget = 'iep' | 'assignment' | null

const HERO_HIGHLIGHTS: Array<{ icon: AppIconName; text: string }> = [
  { icon: 'shield', text: 'Grounded only in your reviewed source materials' },
  { icon: 'notebook', text: 'Built for real classwork, quizzes, and homework' },
  { icon: 'star', text: 'Easy to scan on a phone before class or after school' },
]

const STEP_CONFIG: Array<{
  helper: string
  icon: AppIconName
  id: Screen
  label: string
}> = [
  {
    id: 'iep',
    label: 'IEP details',
    helper: 'Approved supports only',
    icon: 'compass',
  },
  {
    id: 'assignment',
    label: 'Assignment details',
    helper: 'Task clues and classroom context',
    icon: 'assignment',
  },
  {
    id: 'results',
    label: 'Results',
    helper: 'Checkpoint cards and source trail',
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
    title: 'Approved supports only',
    detail: 'We only point to accommodations that appear in the source materials you provide.',
  },
  {
    icon: 'waypoint',
    title: 'Support, not answer-giving',
    detail: 'IEP Compass helps check access supports. It does not complete the assignment itself.',
  },
  {
    icon: 'source',
    title: 'Session-local uploads',
    detail: 'Uploads stay local during this MVP so families can review materials before sharing anything else.',
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

export default function App() {
  const [analysisAdapter] = useState(() => createAnalysisAdapter())
  const [screen, setScreen] = useState<Screen>('iep')
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null)
  const [role, setRole] = useState<Role>('student')
  const [contextTags, setContextTags] = useState<TaskContext[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [teacherConcern, setTeacherConcern] = useState('')
  const [iepSource, setIepSource] = useState<SourceMaterial>(createBlankSource)
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
  const [correctionRole, setCorrectionRole] = useState<Role>('student')
  const [correctionTaskTitle, setCorrectionTaskTitle] = useState('')
  const [correctionTeacherConcern, setCorrectionTeacherConcern] = useState('')
  const [correctionContextTags, setCorrectionContextTags] = useState<
    TaskContext[]
  >([])
  const latestSourcesRef = useRef<SourceMaterial[]>([])
  const analysisRunIdRef = useRef(0)
  const teacherConcernRunIdRef = useRef(0)

  const modelPlan = analysisAdapter.getModelPlan()

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

  function replaceIepSource(nextSource: SourceMaterial) {
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

    setCorrectionRole(role)
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
    return () => {
      latestSourcesRef.current
        .flatMap((source) => source.attachments)
        .forEach(revokeAttachmentPreview)
    }
  }, [])

  async function appendFilesToMainSource(
    sourceKey: 'iep' | 'task',
    files: File[],
  ) {
    const nextAttachments = await Promise.all(
      files.map((file) => toUploadedAttachment(file)),
    )

    if (sourceKey === 'iep') {
      setIepSource((current) => ({
        ...current,
        attachments: [...current.attachments, ...nextAttachments],
      }))
    } else {
      setTaskSource((current) => ({
        ...current,
        attachments: [...current.attachments, ...nextAttachments],
      }))
    }

    setActiveExampleId(null)
    setAnalysisError(null)
    clearTeacherConcernState()
  }

  async function appendFilesToCorrectionSource(
    sourceKey: 'iep' | 'task',
    files: File[],
  ) {
    const nextAttachments = await Promise.all(
      files.map((file) => toUploadedAttachment(file)),
    )

    if (sourceKey === 'iep') {
      setCorrectionIepSource((current) => ({
        ...current,
        attachments: [...current.attachments, ...nextAttachments],
      }))
    } else {
      setCorrectionTaskSource((current) => ({
        ...current,
        attachments: [...current.attachments, ...nextAttachments],
      }))
    }
  }

  function removeMainAttachment(sourceKey: 'iep' | 'task', attachmentId: string) {
    if (sourceKey === 'iep') {
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

  function removeCorrectionAttachment(
    sourceKey: 'iep' | 'task',
    attachmentId: string,
  ) {
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

    replaceIepSource({
      attachments: [],
      text: nextExample.iepExcerpt,
    })
    replaceTaskSource({
      attachments: [],
      text: nextExample.taskText,
    })
    cancelPendingAnalysis()
    setActiveExampleId(nextExample.id)
    setRole(nextExample.role)
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
    setCorrectionRole(nextExample.role)
    setCorrectionTaskTitle(nextExample.taskTitle)
    setCorrectionTeacherConcern(nextExample.teacherConcern ?? '')
    setCorrectionContextTags(nextExample.contextTags)
    setCorrectionTarget(null)
    setScreen('iep')
  }

  function resetAllState() {
    cancelPendingAnalysis()
    replaceIepSource(createBlankSource())
    replaceTaskSource(createBlankSource())

    setCorrectionIepSource((current) => {
      revokeRemovedAttachments(current.attachments, [])
      return createBlankSource()
    })
    setCorrectionTaskSource((current) => {
      revokeRemovedAttachments(current.attachments, [])
      return createBlankSource()
    })

    setRole('student')
    setContextTags([])
    setTaskTitle('')
    setTeacherConcern('')
    setActiveExampleId(null)
    setAnalysis(null)
    setAnalysisError(null)
    setCorrectionRole('student')
    setCorrectionTaskTitle('')
    setCorrectionTeacherConcern('')
    setCorrectionContextTags([])
    setCorrectionTarget(null)
    setScreen('iep')
  }

  function buildTeacherConcernRequest(
    nextIepSource: SourceMaterial,
    nextTaskSource: SourceMaterial,
    nextRole: Role,
    nextTaskTitle: string,
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
      role: nextRole,
      taskTitle: nextTaskTitle.trim(),
      taskSource: getAnalysisSource(nextTaskSource),
      teacherConcern: trimmedConcern,
    }
  }

  async function runPrimaryAnalysis(
    nextIepSource: SourceMaterial,
    nextTaskSource: SourceMaterial,
    nextRole: Role,
    nextTaskTitle: string,
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
        role: nextRole,
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
      role,
      taskTitle,
      contextTags,
    )

    if (!didGenerate) {
      return
    }

    void runTeacherConcernFollowUp(
      buildTeacherConcernRequest(
        iepSource,
        taskSource,
        role,
        taskTitle,
        teacherConcern,
        contextTags,
      ),
    )
  }

  async function handleRegenerateFromCorrection() {
    const nextIepSource = correctionIepSource
    const nextTaskSource = correctionTaskSource
    const nextRole = correctionRole
    const nextTaskTitle = correctionTaskTitle
    const nextTeacherConcern = correctionTeacherConcern
    const nextContextTags = correctionContextTags

    replaceIepSource(nextIepSource)
    replaceTaskSource(nextTaskSource)
    setRole(nextRole)
    setTaskTitle(nextTaskTitle)
    setTeacherConcern(nextTeacherConcern)
    setContextTags(nextContextTags)
    setActiveExampleId(null)
    setCorrectionTarget(null)

    const didGenerate = await runPrimaryAnalysis(
      nextIepSource,
      nextTaskSource,
      nextRole,
      nextTaskTitle,
      nextContextTags,
    )

    if (!didGenerate) {
      return
    }

    void runTeacherConcernFollowUp(
      buildTeacherConcernRequest(
        nextIepSource,
        nextTaskSource,
        nextRole,
        nextTaskTitle,
        nextTeacherConcern,
        nextContextTags,
      ),
    )
  }

  async function handleTeacherConcernReview() {
    if (isAnalyzing) {
      return
    }

    await runTeacherConcernFollowUp(
      buildTeacherConcernRequest(
        iepSource,
        taskSource,
        role,
        taskTitle,
        teacherConcern,
        contextTags,
      ),
    )
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
                    Let&apos;s start with the approved IEP details. Then add the
                    assignment so we can map out what may apply, what to check
                    first, and why.
                  </p>
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
                    Start with approved supports
                  </div>
                  <div className="hero-compass-card__note hero-compass-card__note--bottom">
                    <AppIcon name="results" className="button-icon button-icon--sm" />
                    Follow the checkpoint trail
                  </div>
                </div>
              </div>

              <div className="hero-highlight-list">
                {HERO_HIGHLIGHTS.map((highlight) => (
                  <div
                    key={highlight.text}
                    className={`hero-highlight hero-highlight--${highlight.icon}`}
                  >
                    <span className="hero-highlight__icon" aria-hidden="true">
                      <AppIcon name={highlight.icon} />
                    </span>
                    <span>{highlight.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="app-header__aside">
              <p className="app-header__aside-label">Grounded boundaries</p>
              <p className="app-header__aside-copy">
                We keep the guidance encouraging, but we stay inside a clear
                trust lane the whole time.
              </p>
              <ul className="trust-list">
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
          </header>
        ) : (
          <header className="app-header app-header--compact">
            <div className="app-header__compact">
              <div className="app-header__compact-copy">
                <span className="eyebrow eyebrow--hero">
                  <AppIcon name="waypoint" className="button-icon button-icon--sm" />
                  Guided accommodation journey
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
              ? 'Checkpoint reached'
              : isActive
                ? 'You are here'
                : 'Coming up'

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
                title="Let’s start with the approved IEP details"
                description="Paste the accommodation wording you want us to rely on, then add files only if they help confirm the source trail."
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
                      Next: add the assignment
                    </button>
                  </div>
                }
              >
                <SourceEditor
                  attachments={iepSource.attachments}
                  textLabel="IEP accommodations excerpt"
                  textName="iepExcerpt"
                  textPlaceholder={`Example:\n- Extended time for quizzes and tests\n- Reduced-distraction setting for assessments\n- Directions clarified and chunked`}
                  textValue={iepSource.text}
                  onTextChange={(nextValue) => {
                    setIepSource((current) => ({ ...current, text: nextValue }))
                    setActiveExampleId(null)
                    setAnalysisError(null)
                    clearTeacherConcernState()
                  }}
                  onChooseFiles={(files) => appendFilesToMainSource('iep', files)}
                  onRemoveAttachment={(attachmentId) =>
                    removeMainAttachment('iep', attachmentId)
                  }
                  uploadGuidance="Upload photos, screenshots, PDFs, or text files that help confirm the approved IEP wording. Images and PDFs stay as reference points unless their text is reviewed."
                  emptyState="No IEP files added yet. Bring in anything that helps confirm the approved support list."
                  textFootnote={
                    !canContinueToAssignment ? (
                      <p className="field-message">
                        Add reviewed IEP text before moving on. Text from
                        uploaded files can also count once extracted.
                      </p>
                    ) : null
                  }
                />
              </SectionCard>

              <SectionCard
                eyebrow="Optional"
                title="Try a sample journey first"
                description="Use a realistic scenario to preview the flow before you enter a real student’s materials."
                icon={<AppIcon name="star" />}
              >
                <details className="sample-panel">
                  <summary className="sample-panel__summary">
                    <span className="summary-label">
                      <AppIcon name="spark" className="button-icon button-icon--sm" />
                      Open sample scenarios
                    </span>
                    <span className="meta-badge">Quick fill</span>
                  </summary>

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
                            <span className="mini-chip">{example.role}</span>
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
                </details>
              </SectionCard>
            </>
          ) : null}

          {screen === 'assignment' ? (
            <>
              <SectionCard
                eyebrow="Waypoint 2"
                title="Now add the assignment details"
                description="Describe the task, worksheet, quiz, or assessment so we can check which approved supports may matter here."
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
                          Map the supports
                        </>
                      )}
                    </button>
                  </div>
                }
              >
                <SourceEditor
                  attachments={taskSource.attachments}
                  textLabel="Assignment, worksheet, or quiz details"
                  textName="taskText"
                  textPlaceholder="Paste directions, summarize a worksheet photo, or upload a text file with the assignment details."
                  textValue={taskSource.text}
                  onTextChange={(nextValue) => {
                    setTaskSource((current) => ({ ...current, text: nextValue }))
                    setActiveExampleId(null)
                    setAnalysisError(null)
                    clearTeacherConcernState()
                  }}
                  onChooseFiles={(files) => appendFilesToMainSource('task', files)}
                  onRemoveAttachment={(attachmentId) =>
                    removeMainAttachment('task', attachmentId)
                  }
                  uploadGuidance="Upload screenshots, photos, PDFs, or text files that support the assignment details. Images and PDFs stay as reference material unless their text is also reviewed."
                  emptyState="No assignment files added yet. Include them if they help show what the student is actually being asked to do."
                  textFootnote={
                    <div className="stacked-copy">
                      <p className="field-message">
                        Model plan: {modelPlan.primaryLabel} first, then{' '}
                        {modelPlan.fallbackLabel}.
                        {modelPlan.liveConfigured
                          ? ` ${modelPlan.runtimeLabel} is configured for live analysis.`
                          : ' No endpoint is configured, so the app will use structured demo analysis.'}
                      </p>
                      <p className="field-message">
                        Browser-first Gemma 4 testing now lives in a separate card
                        below, so it does not replace the main IEP Compass flow.
                      </p>
                    </div>
                  }
                >
                  <div className="field-label">
                    <span className="field-label__title">Task title</span>
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

                  <label className="textarea-label">
                    <span className="field-label__title">Optional teacher concern</span>
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
                      Add this if there is a specific question you want the final
                      screen to check after the main support pass.
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
                    onRoleChange={(nextRole) => {
                      setRole(nextRole)
                      setActiveExampleId(null)
                      setAnalysisError(null)
                      clearTeacherConcernState()
                    }}
                    role={role}
                  />
                </SourceEditor>
              </SectionCard>

              <SectionCard
                eyebrow="Optional testing"
                title="Test the browser path without leaving the app"
                description="Use this only to verify the Gemma 4 browser flow and your local backup while we keep the main student-facing UX intact."
                tone="soft"
                icon={<AppIcon name="spark" />}
              >
                <BrowserGemmaApp localModelPlan={modelPlan} />
              </SectionCard>
            </>
          ) : null}

          {screen === 'results' ? (
            <>
              <SectionCard
                eyebrow="Waypoint 3"
                title={taskTitle.trim() || 'Assignment check-in'}
                description="Here’s the guided support map for this task. Start with the checkpoint cards below, then open the deeper review only if you need it."
                tone="accent"
                icon={<AppIcon name="results" />}
              >
                <p className="results-priority-note">
                  These recommendations are tied to this specific assignment or
                  assessment, not to school in general.
                </p>
              </SectionCard>

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
                            Regenerate support map
                          </>
                        )}
                      </button>
                    </div>
                  }
                >
                  <SourceEditor
                    attachments={correctionIepSource.attachments}
                    textLabel="IEP accommodations excerpt"
                    textName="correctionIepExcerpt"
                    textPlaceholder={`Example:\n- Extended time for quizzes and tests\n- Reduced-distraction setting for assessments\n- Directions clarified and chunked`}
                    textValue={correctionIepSource.text}
                    onTextChange={(nextValue) =>
                      setCorrectionIepSource((current) => ({
                        ...current,
                        text: nextValue,
                      }))
                    }
                    onChooseFiles={(files) =>
                      appendFilesToCorrectionSource('iep', files)
                    }
                    onRemoveAttachment={(attachmentId) =>
                      removeCorrectionAttachment('iep', attachmentId)
                    }
                    uploadGuidance="Update the IEP materials here if you missed a detail or want to swap in a better supporting file."
                    emptyState="No IEP files added for this correction draft."
                  />
                </SectionCard>
              ) : null}

              {correctionTarget === 'assignment' ? (
                <SectionCard
                  eyebrow="Correct details"
                  title="Update the assignment source trail"
                  description="Refine the assignment details, role, or context tags, then regenerate from the corrected version."
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
                            Regenerate support map
                          </>
                        )}
                      </button>
                    </div>
                  }
                >
                  <SourceEditor
                    attachments={correctionTaskSource.attachments}
                    textLabel="Assignment, worksheet, or quiz details"
                    textName="correctionTaskText"
                    textPlaceholder="Paste directions, summarize a worksheet photo, or upload a text file with the assignment details."
                    textValue={correctionTaskSource.text}
                    onTextChange={(nextValue) =>
                      setCorrectionTaskSource((current) => ({
                        ...current,
                        text: nextValue,
                      }))
                    }
                    onChooseFiles={(files) =>
                      appendFilesToCorrectionSource('task', files)
                    }
                    onRemoveAttachment={(attachmentId) =>
                      removeCorrectionAttachment('task', attachmentId)
                    }
                    uploadGuidance="Swap in a clearer worksheet photo, upload a better file, or update the written task description before regenerating."
                    emptyState="No assignment files added for this correction draft."
                  >
                    <div className="field-label">
                      <span className="field-label__title">Task title</span>
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

                    <label className="textarea-label">
                      <span className="field-label__title">Optional teacher concern</span>
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
                      onRoleChange={setCorrectionRole}
                      role={correctionRole}
                    />
                  </SourceEditor>
                </SectionCard>
              ) : null}

              {isAnalyzing ? (
                <SectionCard
                  eyebrow="Working"
                  title="Building the support map"
                  description="The results screen stays in place while IEP Compass checks the latest source materials."
                  icon={<AppIcon name="compass" />}
                >
                  <div className="loading-card">
                    <LoadingIndicator label="Checking the task against the approved supports" />
                    <p>
                      We&apos;re only using the approved supports visible in the
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
                <ResultsView
                  analysis={analysis}
                  role={role}
                />
              ) : null}

              {analysis ? (
                <SectionCard
                  eyebrow="Teacher concern"
                  title="Ask a focused follow-up"
                  description="Add or revise a concern here if there is one specific classroom question you want checked next."
                  icon={<AppIcon name="teacher" />}
                >
                  <div className="teacher-concern-stack">
                    <label className="textarea-label">
                      <span className="field-label__title">Teacher concern</span>
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
                        This follow-up runs separately from the main checkpoint
                        cards so it can answer the concern directly.
                      </p>

                      <button
                        className="action-button action-button--secondary"
                        type="button"
                        disabled={!canAddressTeacherConcern || isTeacherConcernAnalyzing}
                        onClick={() => void handleTeacherConcernReview()}
                      >
                        {isTeacherConcernAnalyzing ? (
                          <LoadingIndicator label="Addressing concern" size="sm" />
                        ) : (
                          <>
                            <AppIcon name="quote" className="button-icon" />
                            Check this concern
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
                          <h3>Concern</h3>
                          <p>{teacherConcernAnalysis.result.concern}</p>
                        </div>

                        <div className="results-detail-block">
                          <h3>Evaluation</h3>
                          <p>{teacherConcernAnalysis.result.guidance}</p>
                        </div>

                        <div className="results-detail-block">
                          <h3>How to explain it</h3>
                          <p>{teacherConcernAnalysis.result.suggestedResponse}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
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
                          description="These are the task details the app uses to explain why a listed support may matter here."
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
