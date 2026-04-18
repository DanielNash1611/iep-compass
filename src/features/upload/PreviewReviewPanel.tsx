import { SectionCard } from '../../components/SectionCard'
import type { ModelPlan } from '../../lib/analysis/adapter'
import type { UploadedAttachment } from '../../types/analysis'

interface PreviewReviewPanelProps {
  attachments: UploadedAttachment[]
  iepExcerpt: string
  isAnalyzing: boolean
  isStale: boolean
  modelPlan: ModelPlan
  onAnalyze: () => Promise<void>
  taskText: string
}

function hasPreviewOnlyAttachments(attachments: UploadedAttachment[]) {
  return attachments.some(
    (attachment) =>
      !attachment.reviewedText?.trim()
      && !attachment.documentDraft?.sourceSummaryText?.trim(),
  )
}

export function PreviewReviewPanel({
  attachments,
  iepExcerpt,
  isAnalyzing,
  isStale,
  modelPlan,
  onAnalyze,
  taskText,
}: PreviewReviewPanelProps) {
  const readyForAnalysis = Boolean(iepExcerpt.trim() && taskText.trim())
  const analyzeLabel = modelPlan.liveConfigured
    ? `Analyze with ${modelPlan.primaryLabel}`
    : 'Run structured demo analysis'
  const analyzingLabel = modelPlan.liveConfigured
    ? `Analyzing with ${modelPlan.primaryLabel}...`
    : 'Building structured demo analysis...'

  return (
    <SectionCard
      eyebrow="Step 4"
      title="Review the analysis draft before you run it"
      description="This checkpoint keeps the flow explicit: review the typed text, confirm any structured upload drafts, then ask for a structured accommodation map."
    >
      <div className="review-checklist">
        <div className="review-check">
          <span
            className={`review-check__status${
              iepExcerpt.trim() ? '' : ' review-check__status--pending'
            }`}
          >
            {iepExcerpt.trim() ? '1' : '!'}
          </span>
          <div>
            <strong>IEP excerpt</strong>
            <p>
              {iepExcerpt.trim()
                ? 'Accommodation text is present and ready to constrain the output.'
                : 'Paste the approved accommodations excerpt so the app has a safe source list.'}
            </p>
          </div>
        </div>

        <div className="review-check">
          <span
            className={`review-check__status${
              taskText.trim() ? '' : ' review-check__status--pending'
            }`}
          >
            {taskText.trim() ? '2' : '!'}
          </span>
          <div>
            <strong>Task description</strong>
            <p>
              {taskText.trim()
                ? 'Task details are present, so the app can explain why an accommodation may matter.'
                : 'Paste or describe the worksheet, quiz, or assignment before analyzing.'}
            </p>
          </div>
        </div>

        <div className="review-check">
          <span className="review-check__status">3</span>
          <div>
            <strong>Model plan</strong>
            <p>
              Primary model: {modelPlan.primaryLabel}. Fallback: {modelPlan.fallbackLabel}.
              {modelPlan.liveConfigured
                ? ` ${modelPlan.runtimeLabel} is configured for live analysis.`
                : ' No endpoint is configured yet, so the app stays in demo mode with the same structured schema.'}
            </p>
          </div>
        </div>
      </div>

      <div className="review-actions">
        <button
          className="action-button"
          type="button"
          disabled={!readyForAnalysis || isAnalyzing}
          onClick={() => void onAnalyze()}
        >
          {isAnalyzing ? analyzingLabel : isStale ? 'Refresh analysis' : analyzeLabel}
        </button>

        <p className="review-note">
          {hasPreviewOnlyAttachments(attachments)
            ? 'Some uploads are still reference-only. Review and include any structured upload details you want in the source trail before analyzing.'
            : 'Uploads are optional. The app can still run on pasted text alone.'}
        </p>
      </div>
    </SectionCard>
  )
}
