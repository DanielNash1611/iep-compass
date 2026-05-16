import { AppIcon } from '../../components/AppIcon'
import { SectionCard } from '../../components/SectionCard'
import {
  getCombinedReviewedAttachmentText,
  getPendingReviewAttachments,
  getReferenceOnlyAttachments,
  getSourceReadyAttachments,
} from './sourceText'
import type { SourceMaterial } from '../../types/analysis'

interface SourceReviewPanelProps {
  description: string
  eyebrow: string
  source: SourceMaterial
  title: string
}

export function SourceReviewPanel({
  description,
  eyebrow,
  source,
  title,
}: SourceReviewPanelProps) {
  const reviewedTextAttachments = getSourceReadyAttachments(source.attachments)
  const pendingReviewAttachments = getPendingReviewAttachments(source.attachments)
  const reviewedText = getCombinedReviewedAttachmentText(source.attachments)
  const referenceOnlyAttachments = getReferenceOnlyAttachments(source.attachments)

  return (
    <SectionCard
      eyebrow={eyebrow}
      title={title}
      description={description}
      className="source-review-card"
      icon={<AppIcon name="source" />}
    >
      <details className="source-review-panel">
        <summary className="source-review-panel__summary">
          <span className="summary-label">
            <AppIcon name="notebook" className="button-icon button-icon--sm" />
            See what you added
          </span>
          <span className="meta-badge">
            {source.attachments.length}{' '}
            {source.attachments.length === 1 ? 'file' : 'files'}
          </span>
        </summary>

        <div className="source-review-panel__body">
          <div className="source-review-block">
            <h3>Text you typed</h3>
            {source.text.trim() ? (
              <pre className="source-review-text">{source.text.trim()}</pre>
            ) : (
              <p>You did not type any text here.</p>
            )}
          </div>

          {reviewedTextAttachments.length > 0 ? (
            <div className="source-review-block">
              <h3>File details used in your results</h3>
              <pre className="source-review-text">{reviewedText}</pre>
            </div>
          ) : null}

          {pendingReviewAttachments.length > 0 ? (
            <div className="source-review-block">
              <h3>Files not used yet</h3>
              <p>
                {pendingReviewAttachments.length}{' '}
                {pendingReviewAttachments.length === 1
                  ? 'file still needs a quick check before it can be used.'
                  : 'files still need a quick check before they can be used.'}
              </p>
            </div>
          ) : null}

          <div className="source-review-block">
            <h3>Files you chose not to use</h3>
            {referenceOnlyAttachments.length > 0 ? (
              <div className="source-review-attachments">
                {referenceOnlyAttachments.map((attachment) => (
                  <article key={attachment.id} className="source-review-file">
                    <div
                      className={`attachment-card__preview source-review-file__preview${
                        attachment.previewUrl ? '' : ' attachment-card__preview--placeholder'
                      }`}
                    >
                      {attachment.previewUrl ? (
                        <img
                          src={attachment.previewUrl}
                          alt={`Preview of ${attachment.name}`}
                        />
                      ) : (
                        <span>{attachment.kind.toUpperCase()}</span>
                      )}
                    </div>

                    <div className="source-review-file__content">
                      <h4>{attachment.name}</h4>
                      <div className="attachment-card__meta">
                        <span>{attachment.sizeLabel}</span>
                        <span>{attachment.kind}</span>
                      </div>

                      <ul className="attachment-card__notes">
                        {attachment.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>

                      {attachment.rawTranscript?.trim() ? (
                        <details className="source-snippet">
                          <summary className="source-snippet__summary">
                            <span className="summary-label">
                              <AppIcon
                                name="source"
                                className="button-icon button-icon--sm"
                              />
                              Show the exact text we read
                            </span>
                          </summary>

                          <p className="source-snippet__body">{attachment.rawTranscript}</p>
                        </details>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>Every file you added is being used in your results.</p>
            )}
          </div>
        </div>
      </details>
    </SectionCard>
  )
}
