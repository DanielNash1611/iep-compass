import type { ChangeEvent } from 'react'
import { useId } from 'react'
import { SectionCard } from '../../components/SectionCard'
import type { UploadedAttachment } from '../../types/analysis'

interface UploadPanelProps {
  attachments: UploadedAttachment[]
  onChooseFiles: (files: File[]) => Promise<void>
  onRemoveAttachment: (attachmentId: string) => void
}

function formatStatusLabel(attachment: UploadedAttachment) {
  switch (attachment.status) {
    case 'text_ready':
      return 'Text ready'
    case 'interpret_ready':
      return attachment.kind === 'image' ? 'Ready as reference' : 'Ready to interpret'
    case 'interpret_running':
      return 'Reading document'
    case 'review_ready':
      return 'Review document draft'
    case 'included':
      return 'Included'
    case 'reference_only':
      return 'Reference only'
    default:
      return 'Could not interpret'
  }
}

export function UploadPanel({
  attachments,
  onChooseFiles,
  onRemoveAttachment,
}: UploadPanelProps) {
  const cameraInputId = useId()
  const fileInputId = useId()

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])

    if (files.length > 0) {
      void onChooseFiles(files)
    }

    event.target.value = ''
  }

  return (
    <SectionCard
      eyebrow="Step 3"
      title="Upload a screenshot, photo, PDF, or text file"
      description="Phone capture and Chromebook uploads are both supported. Images preview immediately so the user can review before analysis."
    >
      <div className="field-stack">
        <p className="upload-guidance">
          Files are treated as sensitive by default. This MVP previews uploads and
          keeps analysis grounded in the reviewed text or structured upload draft.
        </p>

        <div className="upload-actions">
          <label className="action-button" htmlFor={cameraInputId}>
            Take photo
          </label>
          <input
            id={cameraInputId}
            className="visually-hidden"
            accept="image/*"
            capture="environment"
            type="file"
            onChange={handleInputChange}
          />

          <label className="action-button action-button--secondary" htmlFor={fileInputId}>
            Upload file
          </label>
          <input
            id={fileInputId}
            className="visually-hidden"
            accept="image/*,application/pdf,text/plain,.txt,.md"
            multiple
            type="file"
            onChange={handleInputChange}
          />
        </div>

        {attachments.length > 0 ? (
          <div className="attachment-list">
            {attachments.map((attachment) => (
              <article key={attachment.id} className="attachment-card">
                <div
                  className={`attachment-card__preview${
                    attachment.previewUrl ? '' : ' attachment-card__preview--placeholder'
                  }`}
                >
                  {attachment.previewUrl ? (
                    <img src={attachment.previewUrl} alt={`Preview of ${attachment.name}`} />
                  ) : (
                    <span>{attachment.kind.toUpperCase()}</span>
                  )}
                </div>

                <div className="attachment-card__content">
                  <div>
                    <h3 className="attachment-card__title">{attachment.name}</h3>
                    <div className="attachment-card__meta">
                      <span>{attachment.sizeLabel}</span>
                      <span>{formatStatusLabel(attachment)}</span>
                    </div>
                  </div>

                  <ul className="attachment-card__notes">
                    {attachment.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>

                  <button
                    className="remove-button"
                    type="button"
                    onClick={() => onRemoveAttachment(attachment.id)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>
            Add a worksheet photo, screenshot, or PDF if it helps the user review
            the task before pasting the text summary.
          </p>
        )}
      </div>
    </SectionCard>
  )
}
