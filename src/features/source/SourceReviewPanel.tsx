import { AppIcon } from '../../components/AppIcon'
import { SectionCard } from '../../components/SectionCard'
import { getCombinedAttachmentText, getExtractedTextAttachments } from './sourceText'
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
  const extractedTextAttachments = getExtractedTextAttachments(source.attachments)
  const extractedText = getCombinedAttachmentText(source.attachments)

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
            Open the source trail
          </span>
          <span className="meta-badge">
            {source.attachments.length}{' '}
            {source.attachments.length === 1 ? 'file' : 'files'}
          </span>
        </summary>

        <div className="source-review-panel__body">
          <div className="source-review-block">
            <h3>Entered text</h3>
            {source.text.trim() ? (
              <pre className="source-review-text">{source.text.trim()}</pre>
            ) : (
              <p>No text was entered directly for this source.</p>
            )}
          </div>

          {extractedTextAttachments.length > 0 ? (
            <div className="source-review-block">
              <h3>Extracted from uploaded text files</h3>
              <pre className="source-review-text">{extractedText}</pre>
            </div>
          ) : null}

          <div className="source-review-block">
            <h3>Uploaded files</h3>
            {source.attachments.length > 0 ? (
              <div className="source-review-attachments">
                {source.attachments.map((attachment) => (
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
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>No files were uploaded for this source.</p>
            )}
          </div>
        </div>
      </details>
    </SectionCard>
  )
}
