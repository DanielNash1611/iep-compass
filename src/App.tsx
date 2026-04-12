import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from 'react'
import './App.css'
import { SectionCard } from './components/SectionCard'
import { exampleScenarios } from './data/examples'
import { ExampleScenarioPicker } from './features/input/ExampleScenarioPicker'
import { IEPExcerptInput } from './features/input/IEPExcerptInput'
import { TaskInput } from './features/input/TaskInput'
import { ResultsView } from './features/results/ResultsView'
import { PreviewReviewPanel } from './features/upload/PreviewReviewPanel'
import { UploadPanel } from './features/upload/UploadPanel'
import {
  revokeAttachmentPreview,
  toUploadedAttachment,
} from './features/upload/fileUtils'
import { createAnalysisAdapter } from './lib/analysis'
import type {
  AnalysisExecution,
  Role,
  TaskContext,
  UploadedAttachment,
} from './types/analysis'

function App() {
  const seededScenario = exampleScenarios[0]
  const [analysisAdapter] = useState(() => createAnalysisAdapter())
  const [activeExampleId, setActiveExampleId] = useState<string | null>(
    seededScenario.id,
  )
  const [role, setRole] = useState<Role>(seededScenario.role)
  const [contextTags, setContextTags] = useState<TaskContext[]>(
    seededScenario.contextTags,
  )
  const [iepExcerpt, setIepExcerpt] = useState(seededScenario.iepExcerpt)
  const [taskText, setTaskText] = useState(seededScenario.taskText)
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([])
  const [analysis, setAnalysis] = useState<AnalysisExecution | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isStale, setIsStale] = useState(false)

  const deferredIepExcerpt = useDeferredValue(iepExcerpt)
  const deferredTaskText = useDeferredValue(taskText)
  const modelPlan = analysisAdapter.getModelPlan()

  const revokeCurrentAttachments = useEffectEvent(() => {
    attachments.forEach(revokeAttachmentPreview)
  })

  useEffect(() => {
    return () => {
      revokeCurrentAttachments()
    }
  }, [])

  function markDraftAsChanged() {
    if (analysis) {
      setIsStale(true)
    }

    setAnalysisError(null)
  }

  function clearAttachments() {
    attachments.forEach(revokeAttachmentPreview)
    setAttachments([])
  }

  function handleExampleSelect(exampleId: string) {
    const nextExample = exampleScenarios.find((example) => example.id === exampleId)

    if (!nextExample) {
      return
    }

    clearAttachments()
    setActiveExampleId(nextExample.id)
    setRole(nextExample.role)
    setContextTags(nextExample.contextTags)
    setIepExcerpt(nextExample.iepExcerpt)
    setTaskText(nextExample.taskText)
    setAnalysis(null)
    setAnalysisError(null)
    setIsStale(false)
  }

  function handleStartBlank() {
    clearAttachments()
    setActiveExampleId(null)
    setRole('student')
    setContextTags([])
    setIepExcerpt('')
    setTaskText('')
    setAnalysis(null)
    setAnalysisError(null)
    setIsStale(false)
  }

  function handleRoleChange(nextRole: Role) {
    setRole(nextRole)
    setActiveExampleId(null)
    markDraftAsChanged()
  }

  function handleContextToggle(nextContext: TaskContext) {
    setContextTags((current) =>
      current.includes(nextContext)
        ? current.filter((contextTag) => contextTag !== nextContext)
        : [...current, nextContext],
    )
    setActiveExampleId(null)
    markDraftAsChanged()
  }

  function handleIepExcerptChange(nextValue: string) {
    setIepExcerpt(nextValue)
    setActiveExampleId(null)
    markDraftAsChanged()
  }

  function handleTaskTextChange(nextValue: string) {
    setTaskText(nextValue)
    setActiveExampleId(null)
    markDraftAsChanged()
  }

  async function handleFilesSelected(files: File[]) {
    const nextAttachments = await Promise.all(
      files.map((file) => toUploadedAttachment(file)),
    )

    setAttachments((current) => [...current, ...nextAttachments])
    setActiveExampleId(null)
    markDraftAsChanged()
  }

  function handleRemoveAttachment(attachmentId: string) {
    setAttachments((current) => {
      const attachmentToRemove = current.find(
        (attachment) => attachment.id === attachmentId,
      )

      if (attachmentToRemove) {
        revokeAttachmentPreview(attachmentToRemove)
      }

      return current.filter((attachment) => attachment.id !== attachmentId)
    })

    markDraftAsChanged()
  }

  async function handleAnalyze() {
    if (!iepExcerpt.trim() || !taskText.trim()) {
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)

    try {
      const nextAnalysis = await analysisAdapter.analyze({
        attachments,
        contextTags,
        iepExcerpt,
        role,
        taskText,
      })

      startTransition(() => {
        setAnalysis(nextAnalysis)
        setIsStale(false)
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Analysis could not be completed. Please review the draft and try again.'

      setAnalysisError(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="app-shell__glow app-shell__glow--warm" aria-hidden="true" />
      <div className="app-shell__glow app-shell__glow--cool" aria-hidden="true" />

      <header className="hero-panel">
        <div className="hero-panel__copy">
          <span className="eyebrow">Phone-first IEP accommodation guidance</span>
          <h1>IEP Compass</h1>
          <p className="hero-panel__lede">
            Map approved accommodations from an IEP excerpt to a worksheet,
            assessment, or class task without inventing new supports or helping
            answer the assignment itself.
          </p>

          <div className="hero-panel__chips">
            <span className="surface-chip">Student, parent, and teacher views</span>
            <span className="surface-chip">Image and file preview before analysis</span>
            <span className="surface-chip">Gemma 4 structured output</span>
          </div>
        </div>

        <aside className="hero-panel__sidebar">
          <p className="hero-panel__sidebar-label">Source of truth</p>
          <h2>Repo-root PRD first</h2>
          <p>
            Every implementation decision in this MVP follows the requirements in
            <code> IEP_Compass_PRD.md</code>.
          </p>

          <ul className="compact-list">
            <li>Only cite accommodations explicitly present in the uploaded excerpt.</li>
            <li>Do not answer test or assignment content.</li>
            <li>Use guidance language, not legal advice.</li>
          </ul>
        </aside>
      </header>

      <main className="workspace-grid">
        <div className="workspace-column">
          <ExampleScenarioPicker
            activeExampleId={activeExampleId}
            examples={exampleScenarios}
            onSelect={handleExampleSelect}
            onStartBlank={handleStartBlank}
          />

          <IEPExcerptInput
            value={iepExcerpt}
            onChange={handleIepExcerptChange}
          />

          <TaskInput
            contextTags={contextTags}
            onContextToggle={handleContextToggle}
            onRoleChange={handleRoleChange}
            onTaskTextChange={handleTaskTextChange}
            role={role}
            taskText={taskText}
          />

          <UploadPanel
            attachments={attachments}
            onChooseFiles={handleFilesSelected}
            onRemoveAttachment={handleRemoveAttachment}
          />

          <PreviewReviewPanel
            attachments={attachments}
            iepExcerpt={deferredIepExcerpt}
            isAnalyzing={isAnalyzing}
            isStale={isStale}
            modelPlan={modelPlan}
            onAnalyze={handleAnalyze}
            taskText={deferredTaskText}
          />
        </div>

        <div className="workspace-column workspace-column--results">
          {analysisError ? (
            <SectionCard
              title="Analysis needs another pass"
              tone="accent"
              description={analysisError}
            >
              <p>
                Review the pasted text and attachments, then try again. The app
                keeps sensitive input local by default and only uses structured
                output that passes schema validation.
              </p>
            </SectionCard>
          ) : null}

          {analysis ? (
            <ResultsView analysis={analysis} isStale={isStale} role={role} />
          ) : (
            <SectionCard
              title="Results will appear here"
              eyebrow="Ready when you are"
              description="Load a sample or enter your own materials, then run the analysis review."
            >
              <div className="placeholder-stack">
                <p>
                  The MVP is seeded with example scenarios so the result flow is
                  stable on first launch, even before a live Gemma endpoint is
                  configured.
                </p>

                <ul className="compact-list">
                  <li>Plain-language summary of what may matter for this task</li>
                  <li>Potentially relevant accommodations with confidence labels</li>
                  <li>Student advocacy language and teacher reminder notes</li>
                  <li>Boundaries that reinforce access, not performance advantage</li>
                </ul>
              </div>
            </SectionCard>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
