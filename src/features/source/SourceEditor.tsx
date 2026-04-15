import type { ChangeEvent, ReactNode } from 'react'
import { useId } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { getExtractedTextAttachments } from './sourceText'
import { useSpeechDictation } from '../../hooks/useSpeechDictation'
import type { UploadedAttachment } from '../../types/analysis'

interface SourceEditorProps {
  attachments: UploadedAttachment[]
  captureLabel?: string
  children?: ReactNode
  emptyState: string
  onChooseFiles: (files: File[]) => Promise<void>
  onRemoveAttachment: (attachmentId: string) => void
  onTextChange: (nextValue: string) => void
  textFootnote?: ReactNode
  textLabel: string
  textName: string
  textPlaceholder: string
  textValue: string
  uploadGuidance: string
  uploadLabel?: string
}

function countLines(text: string) {
  if (!text.trim()) {
    return 0
  }

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length
}

function formatStatusLabel(attachment: UploadedAttachment) {
  switch (attachment.status) {
    case 'ready':
      return 'Ready to use'
    case 'preview_only':
      return 'Preview only'
    default:
      return 'Needs text review'
  }
}

function getAttachmentIconName(
  attachment: UploadedAttachment,
): 'camera' | 'source' | 'upload' {
  switch (attachment.kind) {
    case 'image':
      return 'camera'
    case 'text':
      return 'upload'
    default:
      return 'source'
  }
}

function appendTranscript(currentValue: string, transcript: string) {
  const nextTranscript = transcript.trim()

  if (!nextTranscript) {
    return currentValue
  }

  if (!currentValue.trim()) {
    return nextTranscript
  }

  const separator = currentValue.match(/\s$/) ? '' : ' '
  return `${currentValue}${separator}${nextTranscript}`
}

export function SourceEditor({
  attachments,
  captureLabel = 'Take photo',
  children,
  emptyState,
  onChooseFiles,
  onRemoveAttachment,
  onTextChange,
  textFootnote,
  textLabel,
  textName,
  textPlaceholder,
  textValue,
  uploadGuidance,
  uploadLabel = 'Upload file',
}: SourceEditorProps) {
  const cameraInputId = useId()
  const fileInputId = useId()
  const extractedTextCount = getExtractedTextAttachments(attachments).length

  const {
    errorMessage,
    isListening,
    isSupported,
    resetErrorMessage,
    start,
    stop,
  } = useSpeechDictation({
    onTranscript: (transcript) => {
      onTextChange(appendTranscript(textValue, transcript))
    },
  })

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])

    if (files.length > 0) {
      void onChooseFiles(files)
    }

    event.target.value = ''
  }

  return (
    <div className="source-editor">
      {children}

      <label className="textarea-label">
        <span className="field-label__title field-label__title--with-icon">
          <span className="field-label__icon">
            <AppIcon name="notebook" />
          </span>
          <span>{textLabel}</span>
        </span>
        <span className="field-label__help">
          Start with the reviewed wording you want IEP Compass to rely on. Files
          can back it up, but typed text keeps the guidance easy to trace.
        </span>
        <div className="textarea-shell">
          <textarea
            className="textarea-input textarea-input--with-dictation"
            name={textName}
            placeholder={textPlaceholder}
            value={textValue}
            onChange={(event) => onTextChange(event.target.value)}
          />

          <button
            className={`dictation-button${
              isListening ? ' dictation-button--active' : ''
            }`}
            type="button"
            aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
            title={
              isListening
                ? 'Stop voice dictation'
                : isSupported
                  ? 'Start voice dictation'
                  : 'Voice dictation may be unavailable in this browser'
            }
            onClick={() => {
              if (isListening) {
                stop()
                return
              }

              start()
            }}
          >
            <AppIcon name="microphone" />
          </button>
        </div>
      </label>

      <div className="source-editor__hint-strip" aria-label="Helpful tips">
        <span className="helper-chip helper-chip--success">
          <AppIcon name="source" className="button-icon button-icon--sm" />
          Reviewed text is what we quote back
        </span>
        <span className="helper-chip helper-chip--info">
          <AppIcon name="upload" className="button-icon button-icon--sm" />
          Files can support the source trail
        </span>
        <span className="helper-chip helper-chip--accent">
          <AppIcon
            name={isSupported ? 'microphone' : 'star'}
            className="button-icon button-icon--sm"
          />
          {isSupported
            ? 'Voice can help you jot notes'
            : 'Keep the wording short and easy to scan'}
        </span>
      </div>

      <div className="field-footer">
        <span>{countLines(textValue)} lines entered</span>
        <span>{textValue.trim().length} characters</span>
      </div>

      {isListening ? (
        <p className="field-message">Listening now. The transcript will be added here.</p>
      ) : null}

      {errorMessage ? (
        <p className="field-message field-message--warning">
          {errorMessage}{' '}
          <button
            className="inline-action"
            type="button"
            onClick={resetErrorMessage}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      {textFootnote ? <div className="source-editor__footnote">{textFootnote}</div> : null}

      <div className="source-editor__uploads">
        <div className="source-editor__uploads-header">
          <div className="field-label__title field-label__title--with-icon">
            <span className="field-label__icon">
              <AppIcon name="upload" />
            </span>
            <span>Add backup materials</span>
          </div>
          <p className="upload-guidance">{uploadGuidance}</p>
        </div>

        {extractedTextCount > 0 ? (
          <p className="field-message">
            {extractedTextCount}{' '}
            {extractedTextCount === 1 ? 'text upload is' : 'text uploads are'} ready
            to strengthen the source material for analysis.
          </p>
        ) : null}

        <div className="upload-actions">
          <label className="action-button" htmlFor={cameraInputId}>
            <AppIcon name="camera" className="button-icon" />
            {captureLabel}
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
            <AppIcon name="upload" className="button-icon" />
            {uploadLabel}
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
                  <div className="attachment-card__filetype">
                    <AppIcon name={getAttachmentIconName(attachment)} />
                    <span>{attachment.kind.toUpperCase()}</span>
                  </div>
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
        <div className="source-editor__empty">
          <span className="source-editor__empty-icon" aria-hidden="true">
            <AppIcon name="star" />
          </span>
          <p>{emptyState}</p>
        </div>
      )}
    </div>
  )
}
