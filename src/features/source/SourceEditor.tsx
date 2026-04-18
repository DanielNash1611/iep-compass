import type { ChangeEvent, ReactNode } from 'react'
import { useId } from 'react'
import type {
  IepReviewDraft,
  StructuredDocumentDraft,
  TaskReviewDraft,
  UnknownReviewDraft,
} from '../../lib/schema/ocrSchema'
import { AppIcon } from '../../components/AppIcon'
import { useSpeechDictation } from '../../hooks/useSpeechDictation'
import type { UploadedAttachment } from '../../types/analysis'
import {
  getPendingReviewAttachments,
  getSourceReadyAttachments,
} from './sourceText'
import type { GemmaDocumentPlan } from '../upload/gemmaOcr'

interface SourceEditorProps {
  attachments: UploadedAttachment[]
  captureLabel?: string
  children?: ReactNode
  documentPlan: GemmaDocumentPlan
  emptyState: string
  onAttachmentDocumentDraftChange: (
    attachmentId: string,
    nextDraft: UploadedAttachment['documentDraft'],
  ) => void
  onAttachmentTextDraftChange: (attachmentId: string, nextValue: string) => void
  onChooseFiles: (files: File[]) => Promise<void>
  onKeepAttachmentReference: (attachmentId: string) => void
  onRemoveAttachment: (attachmentId: string) => void
  onRunAttachmentInterpretation: (attachmentId: string) => Promise<void>
  onTextChange: (nextValue: string) => void
  onUseAttachmentSource: (attachmentId: string) => void
  textFootnote?: ReactNode
  textHelp: string
  textLabel: string
  textName: string
  textPlaceholder: string
  textValue: string
  uploadEmptyBadge?: string
  uploadGuidance: string
  uploadLabel?: string
  uploadSummaryTitle?: string
  uploadsFirst?: boolean
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
    case 'text_ready':
      return 'Text ready'
    case 'interpret_ready':
      return 'Ready to interpret'
    case 'interpret_running':
      return attachment.kind === 'text' ? 'Reading locally' : 'Interpreting with Gemma'
    case 'review_ready':
      return 'Review draft'
    case 'included':
      return 'Included in source trail'
    case 'reference_only':
      return 'Reference only'
    case 'failed':
      return 'Could not interpret'
    default:
      return 'Needs review'
  }
}

function getStatusBadgeClassName(attachment: UploadedAttachment) {
  if (attachment.status === 'interpret_running') {
    return 'meta-badge meta-badge--running'
  }

  return 'meta-badge'
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

function parseBullets(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean)
}

function formatBullets(items: string[]) {
  return items.join('\n')
}

function canRunInterpretation(attachment: UploadedAttachment) {
  return (
    (attachment.kind === 'image' || attachment.kind === 'pdf') &&
    (attachment.status === 'interpret_ready' || attachment.status === 'failed')
  )
}

function hasIncludedSource(attachment: UploadedAttachment) {
  return Boolean(
    attachment.documentDraft?.sourceSummaryText?.trim()
      || attachment.reviewedText?.trim()
      || attachment.extractedText?.trim(),
  )
}

function renderRawTranscript(rawTranscript?: string) {
  if (!rawTranscript?.trim()) {
    return null
  }

  return (
    <details className="source-snippet">
      <summary className="source-snippet__summary">
        <span className="summary-label">
          <AppIcon name="source" className="button-icon button-icon--sm" />
          Show raw transcript
        </span>
      </summary>

      <p className="source-snippet__body">{rawTranscript}</p>
    </details>
  )
}

function TextAttachmentReview({
  attachment,
  onAttachmentTextDraftChange,
  onKeepAttachmentReference,
  onUseAttachmentSource,
}: {
  attachment: UploadedAttachment
  onAttachmentTextDraftChange: (attachmentId: string, nextValue: string) => void
  onKeepAttachmentReference: (attachmentId: string) => void
  onUseAttachmentSource: (attachmentId: string) => void
}) {
  if (
    !attachment.extractedText
    || (attachment.status !== 'review_ready'
      && attachment.status !== 'included'
      && attachment.status !== 'reference_only'
      && attachment.status !== 'text_ready')
  ) {
    return null
  }

  return (
    <div className="attachment-review">
      <label className="textarea-label">
        <span className="field-label__title">Review this extracted text</span>
        <span className="field-label__help">
          Check this wording before using it in the accommodation map.
        </span>
        <textarea
          className="textarea-input textarea-input--compact"
          rows={6}
          value={attachment.reviewedText ?? attachment.extractedText}
          onChange={(event) =>
            onAttachmentTextDraftChange(attachment.id, event.target.value)
          }
        />
      </label>

      {attachment.readContainsUnclearText ? (
        <p className="field-message field-message--warning">
          This extraction includes at least one uncertain placeholder such as
          `[unclear]`, `[blank]`, or `[redacted]`. Keep those spots cautious in the
          source trail unless you can confirm the exact wording.
        </p>
      ) : null}

      <div className="screen-actions screen-actions--split">
        {attachment.status === 'included' ? (
          <p className="field-message">
            This reviewed text is already part of the source trail.
          </p>
        ) : (
          <button
            className="action-button"
            type="button"
            onClick={() => onUseAttachmentSource(attachment.id)}
          >
            Use this text in the source trail
          </button>
        )}

        <button
          className="ghost-button"
          type="button"
          onClick={() => onKeepAttachmentReference(attachment.id)}
        >
          Keep as reference only
        </button>
      </div>
    </div>
  )
}

function IepDocumentReview({
  attachment,
  draft,
  onAttachmentDocumentDraftChange,
  onKeepAttachmentReference,
  onUseAttachmentSource,
}: {
  attachment: UploadedAttachment
  draft: IepReviewDraft
  onAttachmentDocumentDraftChange: (
    attachmentId: string,
    nextDraft: StructuredDocumentDraft,
  ) => void
  onKeepAttachmentReference: (attachmentId: string) => void
  onUseAttachmentSource: (attachmentId: string) => void
}) {
  return (
    <div className="attachment-review">
      <div className="results-detail-block">
        <h3>Structured IEP draft</h3>
        <p className="field-label__help">
          Review the sectioned accommodation list before adding it to the source trail.
        </p>
      </div>

      <div className="attachment-review-grid">
        <label className="field-label">
          <span className="field-label__title">Student name</span>
          <input
            className="text-input"
            value={draft.studentName}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                studentName: event.target.value,
              })
            }
          />
        </label>

        <label className="field-label">
          <span className="field-label__title">District</span>
          <input
            className="text-input"
            value={draft.district}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                district: event.target.value,
              })
            }
          />
        </label>

        <label className="field-label">
          <span className="field-label__title">DOB</span>
          <input
            className="text-input"
            value={draft.dob}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                dob: event.target.value,
              })
            }
          />
        </label>

        <label className="field-label">
          <span className="field-label__title">Meeting date</span>
          <input
            className="text-input"
            value={draft.meetingDate}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                meetingDate: event.target.value,
              })
            }
          />
        </label>
      </div>

      <label className="textarea-label">
        <span className="field-label__title">Learning disability or profile wording</span>
        <span className="field-label__help">
          Keep this empty if the image does not clearly show any profile wording.
        </span>
        <textarea
          className="textarea-input textarea-input--compact"
          rows={draft.learningDisabilityOrProfileText.length > 0 ? 4 : 3}
          placeholder="No disability or profile wording detected in this image."
          value={formatBullets(draft.learningDisabilityOrProfileText)}
          onChange={(event) =>
            onAttachmentDocumentDraftChange(attachment.id, {
              ...draft,
              learningDisabilityOrProfileText: parseBullets(event.target.value),
            })
          }
        />
      </label>

      {draft.sections.map((section, index) => (
        <div key={`${section.title}-${index}`} className="results-detail-block">
          <h3>{section.title}</h3>
          <textarea
            className="textarea-input textarea-input--compact"
            rows={Math.max(4, section.items.length + 1)}
            value={formatBullets(section.items)}
            onChange={(event) => {
              const nextSections = draft.sections.map((currentSection, currentIndex) =>
                currentIndex === index
                  ? {
                      ...currentSection,
                      items: parseBullets(event.target.value),
                    }
                  : currentSection,
              )

              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                sections: nextSections,
              })
            }}
          />
        </div>
      ))}

      <label className="textarea-label">
        <span className="field-label__title">Modifications</span>
        <textarea
          className="textarea-input textarea-input--compact"
          rows={4}
          placeholder="None"
          value={formatBullets(draft.modifications)}
          onChange={(event) =>
            onAttachmentDocumentDraftChange(attachment.id, {
              ...draft,
              modifications: parseBullets(event.target.value),
            })
          }
        />
      </label>

      {renderRawTranscript(attachment.rawTranscript)}

      <div className="screen-actions screen-actions--split">
        {attachment.status === 'included' ? (
          <p className="field-message">
            These reviewed IEP details are already part of the source trail.
          </p>
        ) : (
          <button
            className="action-button"
            type="button"
            onClick={() => onUseAttachmentSource(attachment.id)}
          >
            Use these IEP details in the source trail
          </button>
        )}

        <button
          className="ghost-button"
          type="button"
          onClick={() => onKeepAttachmentReference(attachment.id)}
        >
          Keep as reference only
        </button>
      </div>
    </div>
  )
}

function TaskDocumentReview({
  attachment,
  draft,
  onAttachmentDocumentDraftChange,
  onKeepAttachmentReference,
  onUseAttachmentSource,
}: {
  attachment: UploadedAttachment
  draft: TaskReviewDraft
  onAttachmentDocumentDraftChange: (
    attachmentId: string,
    nextDraft: StructuredDocumentDraft,
  ) => void
  onKeepAttachmentReference: (attachmentId: string) => void
  onUseAttachmentSource: (attachmentId: string) => void
}) {
  return (
    <div className="attachment-review">
      <label className="textarea-label">
        <span className="field-label__title">Task description</span>
        <span className="field-label__help">
          Keep this focused on what the page appears to ask the student to do.
        </span>
        <textarea
          className="textarea-input textarea-input--compact"
          rows={4}
          value={draft.taskDescription}
          onChange={(event) =>
            onAttachmentDocumentDraftChange(attachment.id, {
              ...draft,
              taskDescription: event.target.value,
            })
          }
        />
      </label>

      <div className="attachment-review-grid">
        <label className="field-label">
          <span className="field-label__title">Subject</span>
          <input
            className="text-input"
            value={draft.subject}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                subject: event.target.value,
              })
            }
          />
        </label>

        <label className="field-label">
          <span className="field-label__title">Topic</span>
          <input
            className="text-input"
            value={draft.topic}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                topic: event.target.value,
              })
            }
          />
        </label>

        <label className="field-label">
          <span className="field-label__title">Work type</span>
          <select
            className="text-input"
            value={draft.workType}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                workType: event.target.value as TaskReviewDraft['workType'],
              })
            }
          >
            <option value="worksheet">Worksheet</option>
            <option value="quiz">Quiz</option>
            <option value="test">Test</option>
            <option value="practice">Practice</option>
            <option value="classwork">Classwork</option>
            <option value="homework">Homework</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>

        <label className="field-label">
          <span className="field-label__title">Timed status</span>
          <select
            className="text-input"
            value={draft.timedStatus}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                timedStatus: event.target.value as TaskReviewDraft['timedStatus'],
              })
            }
          >
            <option value="timed">Timed</option>
            <option value="untimed">Untimed</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>

        <label className="field-label">
          <span className="field-label__title">Calculation focus</span>
          <select
            className="text-input"
            value={draft.calculationFocus}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                calculationFocus: event.target.value as TaskReviewDraft['calculationFocus'],
              })
            }
          >
            <option value="calculation_focused">Calculation focused</option>
            <option value="not_calculation_focused">Not calculation focused</option>
            <option value="mixed_or_unknown">Mixed or unknown</option>
          </select>
        </label>
      </div>

      <label className="textarea-label">
        <span className="field-label__title">Visible evidence</span>
        <span className="field-label__help">
          Keep these as short observations grounded in what is visible on the page.
        </span>
        <textarea
          className="textarea-input textarea-input--compact"
          rows={4}
          value={formatBullets(draft.evidenceBullets)}
          onChange={(event) =>
            onAttachmentDocumentDraftChange(attachment.id, {
              ...draft,
              evidenceBullets: parseBullets(event.target.value),
            })
          }
        />
      </label>

      {renderRawTranscript(attachment.rawTranscript)}

      <div className="screen-actions screen-actions--split">
        {attachment.status === 'included' ? (
          <p className="field-message">
            These reviewed task details are already part of the source trail.
          </p>
        ) : (
          <button
            className="action-button"
            type="button"
            onClick={() => onUseAttachmentSource(attachment.id)}
          >
            Use these task details in the source trail
          </button>
        )}

        <button
          className="ghost-button"
          type="button"
          onClick={() => onKeepAttachmentReference(attachment.id)}
        >
          Keep as reference only
        </button>
      </div>
    </div>
  )
}

function UnknownDocumentReview({
  attachment,
  draft,
  onAttachmentDocumentDraftChange,
  onKeepAttachmentReference,
  onUseAttachmentSource,
}: {
  attachment: UploadedAttachment
  draft: UnknownReviewDraft
  onAttachmentDocumentDraftChange: (
    attachmentId: string,
    nextDraft: StructuredDocumentDraft,
  ) => void
  onKeepAttachmentReference: (attachmentId: string) => void
  onUseAttachmentSource: (attachmentId: string) => void
}) {
  return (
    <div className="attachment-review">
      <label className="textarea-label">
        <span className="field-label__title">Document summary</span>
        <textarea
          className="textarea-input textarea-input--compact"
          rows={4}
          value={draft.summary}
          onChange={(event) =>
            onAttachmentDocumentDraftChange(attachment.id, {
              ...draft,
              summary: event.target.value,
            })
          }
        />
      </label>

      <label className="textarea-label">
        <span className="field-label__title">Visible evidence</span>
        <textarea
          className="textarea-input textarea-input--compact"
          rows={4}
          value={formatBullets(draft.evidenceBullets)}
          onChange={(event) =>
            onAttachmentDocumentDraftChange(attachment.id, {
              ...draft,
              evidenceBullets: parseBullets(event.target.value),
            })
          }
        />
      </label>

      {renderRawTranscript(attachment.rawTranscript)}

      <div className="screen-actions screen-actions--split">
        {attachment.status === 'included' ? (
          <p className="field-message">
            These reviewed document notes are already part of the source trail.
          </p>
        ) : (
          <button
            className="action-button"
            type="button"
            onClick={() => onUseAttachmentSource(attachment.id)}
          >
            Use these document notes in the source trail
          </button>
        )}

        <button
          className="ghost-button"
          type="button"
          onClick={() => onKeepAttachmentReference(attachment.id)}
        >
          Keep as reference only
        </button>
      </div>
    </div>
  )
}

function StructuredAttachmentReview({
  attachment,
  onAttachmentDocumentDraftChange,
  onKeepAttachmentReference,
  onUseAttachmentSource,
}: {
  attachment: UploadedAttachment
  onAttachmentDocumentDraftChange: (
    attachmentId: string,
    nextDraft: UploadedAttachment['documentDraft'],
  ) => void
  onKeepAttachmentReference: (attachmentId: string) => void
  onUseAttachmentSource: (attachmentId: string) => void
}) {
  if (
    !attachment.documentDraft
    || (attachment.status !== 'review_ready'
      && attachment.status !== 'included'
      && attachment.status !== 'reference_only')
  ) {
    return null
  }

  if ('sections' in attachment.documentDraft) {
    return (
      <IepDocumentReview
        attachment={attachment}
        draft={attachment.documentDraft}
        onAttachmentDocumentDraftChange={onAttachmentDocumentDraftChange}
        onKeepAttachmentReference={onKeepAttachmentReference}
        onUseAttachmentSource={onUseAttachmentSource}
      />
    )
  }

  if ('taskDescription' in attachment.documentDraft) {
    return (
      <TaskDocumentReview
        attachment={attachment}
        draft={attachment.documentDraft}
        onAttachmentDocumentDraftChange={onAttachmentDocumentDraftChange}
        onKeepAttachmentReference={onKeepAttachmentReference}
        onUseAttachmentSource={onUseAttachmentSource}
      />
    )
  }

  return (
    <UnknownDocumentReview
      attachment={attachment}
      draft={attachment.documentDraft}
      onAttachmentDocumentDraftChange={onAttachmentDocumentDraftChange}
      onKeepAttachmentReference={onKeepAttachmentReference}
      onUseAttachmentSource={onUseAttachmentSource}
    />
  )
}

export function SourceEditor({
  attachments,
  captureLabel = 'Take photo',
  children,
  documentPlan,
  emptyState,
  onAttachmentDocumentDraftChange,
  onAttachmentTextDraftChange,
  onChooseFiles,
  onKeepAttachmentReference,
  onRemoveAttachment,
  onRunAttachmentInterpretation,
  onTextChange,
  onUseAttachmentSource,
  textFootnote,
  textHelp,
  textLabel,
  textName,
  textPlaceholder,
  textValue,
  uploadEmptyBadge = 'Use this if that is easier',
  uploadGuidance,
  uploadLabel = 'Upload file',
  uploadSummaryTitle = 'Add from a photo or file',
  uploadsFirst = false,
}: SourceEditorProps) {
  const cameraInputId = useId()
  const fileInputId = useId()
  const reviewedSourceCount = getSourceReadyAttachments(attachments).length
  const pendingReviewCount = getPendingReviewAttachments(attachments).length
  const showUploadPanel = attachments.length > 0

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

  const textEditor = (
    <>
      <label className="textarea-label">
        <span className="field-label__title field-label__title--with-icon">
          <span className="field-label__icon">
            <AppIcon name="notebook" />
          </span>
          <span>{textLabel}</span>
        </span>
        <span className="field-label__help">{textHelp}</span>
        <div
          className={`textarea-shell${
            isListening ? ' textarea-shell--listening' : ''
          }`}
        >
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
            aria-pressed={isListening}
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
            <span>{isListening ? 'Recording' : 'Dictate'}</span>
          </button>
        </div>
      </label>

      {isListening ? (
        <p className="field-message field-message--live">
          <span className="live-dot" aria-hidden="true" />
          Recording now. Tap the button again to stop, and the transcript will keep
          appearing here.
        </p>
      ) : null}

      {textValue.trim() ? (
        <p className="field-message">
          {countLines(textValue)} {countLines(textValue) === 1 ? 'line' : 'lines'} ready
          for the guidance map.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="field-message field-message--warning">
          {errorMessage}{' '}
          <button className="inline-action" type="button" onClick={resetErrorMessage}>
            Dismiss
          </button>
        </p>
      ) : null}

      {textFootnote ? <div className="source-editor__footnote">{textFootnote}</div> : null}
    </>
  )

  const uploadPanel = (
    <details className="source-editor__uploads-panel" open={showUploadPanel || uploadsFirst}>
      <summary className="source-editor__uploads-summary">
        <span className="summary-label">
          <AppIcon name="upload" className="button-icon button-icon--sm" />
          {uploadSummaryTitle}
        </span>
        <span className="meta-badge">
          {attachments.length > 0
            ? `${attachments.length} ${attachments.length === 1 ? 'file' : 'files'}`
            : uploadEmptyBadge}
        </span>
      </summary>

      <div className="source-editor__uploads-body">
        <p className="upload-guidance">{uploadGuidance}</p>

        {reviewedSourceCount > 0 ? (
          <p className="field-message">
            {reviewedSourceCount}{' '}
            {reviewedSourceCount === 1 ? 'upload is' : 'uploads are'} already part
            of this source trail.
          </p>
        ) : null}

        {pendingReviewCount > 0 ? (
          <p className="field-message">
            {pendingReviewCount}{' '}
            {pendingReviewCount === 1
              ? 'upload still needs review'
              : 'uploads still need review'}{' '}
            before it can join the source trail.
          </p>
        ) : null}

        {documentPlan.isRemote &&
        attachments.some(
          (attachment) => attachment.kind === 'image' || attachment.kind === 'pdf',
        ) ? (
          <p className="field-message">
            If you choose <strong>Interpret with Gemma 4</strong>, this step sends
            the file image to your configured model endpoint so it can build
            reviewable text or a structured task draft.
          </p>
        ) : null}

        {!documentPlan.configured &&
        attachments.some(
          (attachment) => attachment.kind === 'image' || attachment.kind === 'pdf',
        ) ? (
          <p className="field-message field-message--warning">
            Gemma document reading is not configured yet, so image and PDF review
            will stay manual for now.
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

        {attachments.length > 0 ? (
          <div className="attachment-list">
            {attachments.map((attachment) => {
              const canInterpret = canRunInterpretation(attachment)
              const showUseButton =
                attachment.status !== 'included' && hasIncludedSource(attachment)

              return (
                <article key={attachment.id} className="attachment-card">
                  <div className="attachment-card__header">
                    <div>
                      <p className="attachment-card__eyebrow">
                        <AppIcon
                          name={getAttachmentIconName(attachment)}
                          className="button-icon button-icon--sm"
                        />
                        {attachment.name}
                      </p>
                      <h3>{attachment.name}</h3>
                    </div>

                    <div className="attachment-card__status">
                      <span className={getStatusBadgeClassName(attachment)}>
                        {formatStatusLabel(attachment)}
                      </span>
                      <button
                        className="ghost-button ghost-button--danger"
                        type="button"
                        onClick={() => onRemoveAttachment(attachment.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="attachment-card__actions">
                    {canInterpret ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => void onRunAttachmentInterpretation(attachment.id)}
                      >
                        Interpret with Gemma 4
                      </button>
                    ) : null}

                    {showUseButton ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => onUseAttachmentSource(attachment.id)}
                      >
                        Include in source trail
                      </button>
                    ) : null}

                    {attachment.status !== 'reference_only' ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => onKeepAttachmentReference(attachment.id)}
                      >
                        Keep as reference
                      </button>
                    ) : null}
                  </div>

                  <TextAttachmentReview
                    attachment={attachment}
                    onAttachmentTextDraftChange={onAttachmentTextDraftChange}
                    onKeepAttachmentReference={onKeepAttachmentReference}
                    onUseAttachmentSource={onUseAttachmentSource}
                  />

                  <StructuredAttachmentReview
                    attachment={attachment}
                    onAttachmentDocumentDraftChange={onAttachmentDocumentDraftChange}
                    onKeepAttachmentReference={onKeepAttachmentReference}
                    onUseAttachmentSource={onUseAttachmentSource}
                  />
                </article>
              )
            })}
          </div>
        ) : (
          <p className="source-editor__empty">{emptyState}</p>
        )}
      </div>
    </details>
  )

  return (
    <div className="source-editor">
      {children}
      {uploadsFirst ? uploadPanel : null}
      {textEditor}
      {!uploadsFirst ? uploadPanel : null}
    </div>
  )
}
