import type { ChangeEvent, ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
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
import type { GemmaDocumentPlan } from '../upload/documentReadingSupport'
import {
  getDocumentReadingStatusMessages,
} from '../upload/documentReadingSupport'
import { formatElapsedTime } from '../upload/fileUtils'
import { formatAccommodationReviewText } from '../../lib/text/accommodationReviewFormatting'
import { toStudentFacingFollowUp } from '../../lib/text/assignmentFollowUps'
import { getAttachmentInterpretationAction } from './interpretationAvailability'
import { getJordanDemoRecordedRun } from '../../data/demoCase'

interface SourceEditorProps {
  attachments: UploadedAttachment[]
  captureLabel?: string
  children?: ReactNode
  documentPlan: GemmaDocumentPlan
  emptyState: string
  onApplyAttachmentTextReview: (
    attachmentId: string,
    nextValue: string,
    mode: 'add' | 'dismiss' | 'replace',
  ) => void
  onAttachmentDocumentDraftChange: (
    attachmentId: string,
    nextDraft: UploadedAttachment['documentDraft'],
  ) => void
  onChooseFiles: (files: File[]) => Promise<void>
  onKeepAttachmentReference: (attachmentId: string) => void
  onApplyDemoAccommodationCorrection?: (attachmentId: string) => void
  onApplyDemoRecordedRun?: (attachmentId: string) => void
  onRemoveAttachment: (attachmentId: string) => void
  onRunAttachmentInterpretation: (attachmentId: string) => Promise<void>
  onTextChange: (nextValue: string) => void
  onUseAttachmentSource: (attachmentId: string) => void
  textFootnote?: ReactNode
  textHelp: string
  textLabel: string
  textName: string
  textPlaceholder: string
  textRequired?: boolean
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
    case 'applied_to_text':
      return 'Added'
    case 'text_ready':
      return 'Ready to check'
    case 'interpret_ready':
      return 'Ready to read'
    case 'interpret_running':
      return 'Reading…'
    case 'review_ready':
      return 'Ready to check'
    case 'included':
      return 'Added'
    case 'reference_only':
      return 'Not added'
    case 'failed':
      return "Couldn't read it"
    default:
      return 'Needs a check'
  }
}

function getStatusBadgeClassName(attachment: UploadedAttachment) {
  if (attachment.status === 'interpret_running') {
    return 'meta-badge meta-badge--running'
  }

  return 'meta-badge'
}

function getInterpretationElapsedMs(attachment: UploadedAttachment, now: number) {
  const progress = attachment.interpretationProgress

  if (!progress) {
    return 0
  }

  if (typeof progress.elapsedMs === 'number') {
    return progress.elapsedMs
  }

  return (progress.finishedAt ?? now) - progress.startedAt
}

function getProgressStepLabel(attachment: UploadedAttachment) {
  const progress = attachment.interpretationProgress

  if (!progress?.stepIndex || !progress.stepTotal) {
    return null
  }

  return `Step ${progress.stepIndex} of ${progress.stepTotal}`
}

function InterpretationProgressStatus({
  attachment,
  now,
}: {
  attachment: UploadedAttachment
  now: number
}) {
  const progress = attachment.interpretationProgress

  if (!progress) {
    return null
  }

  const isRunning = attachment.status === 'interpret_running'

  if (!isRunning && progress.phase !== 'complete') {
    return null
  }

  const stepLabel = getProgressStepLabel(attachment)
  const elapsedLabel = formatElapsedTime(getInterpretationElapsedMs(attachment, now))

  return (
    <div
      className={`interpretation-progress${
        isRunning ? ' interpretation-progress--running' : ''
      }`}
      aria-live={isRunning ? 'polite' : undefined}
    >
      <div className="interpretation-progress__header">
        <span className="interpretation-progress__title">{progress.label}</span>
        <span className="interpretation-progress__time">
          {isRunning ? `${elapsedLabel} so far` : `Took ${elapsedLabel}`}
        </span>
      </div>

      <div className="interpretation-progress__meta">
        {stepLabel ? <span>{stepLabel}</span> : null}
        {progress.phase === 'downloading_model' ? (
          <span>Downloading model</span>
        ) : null}
      </div>

      {progress.detail ? (
        <p className="interpretation-progress__detail">{progress.detail}</p>
      ) : null}
    </div>
  )
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

function getFollowUpQuestionText(item: string) {
  return toStudentFacingFollowUp(item.replace(/\s+Answer:\s*.*$/i, '').trim())
}

function getFollowUpAnswer(item: string) {
  const match = item.match(/\s+Answer:\s*(.*)$/i)

  return match?.[1]?.trim() ?? ''
}

function isYesNoQuestion(question: string) {
  return /^check whether\b/i.test(question.trim())
}

function isAccommodationFocusQuestion(question: string) {
  return /practice work,\s*the actual quiz\/test,\s*or both/i.test(question)
}

function formatFollowUpAnswer(question: string, answer: string) {
  const trimmedQuestion = question.trim()
  const trimmedAnswer = answer.trim()

  return trimmedAnswer ? `${trimmedQuestion} Answer: ${trimmedAnswer}` : trimmedQuestion
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
          Show the exact text we read
        </span>
      </summary>

      <p className="source-snippet__body">{rawTranscript}</p>
    </details>
  )
}

function DemoDraftProvenance({ attachment }: { attachment: UploadedAttachment }) {
  if (!attachment.isDemoSeed) {
    return null
  }

  const hasDemoCorrection = Boolean(attachment.demoCorrectionSource)
  const hasLiveDraft = Boolean(attachment.readMethod)

  if (!hasDemoCorrection && !hasLiveDraft) {
    return null
  }

  const sourceLabel = hasDemoCorrection
    ? 'Local Gemma image reader, then reviewed correction'
    : 'Local Gemma image reader'

  return (
    <div className="demo-draft-provenance">
      <div>
        <p className="eyebrow">Demo draft source</p>
        <p className="field-message">
          {sourceLabel}. Review this draft before it becomes part of the source trail.
        </p>
      </div>

      {attachment.manualEditSummary?.length ? (
        <details className="source-snippet">
          <summary className="source-snippet__summary">
            <span className="summary-label">
              <AppIcon name="check" className="button-icon button-icon--sm" />
              What was cleaned up
            </span>
          </summary>
          <ul className="attachment-card__notes">
            {attachment.manualEditSummary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {attachment.rawDemoOutput?.trim() ? (
        <details className="source-snippet">
          <summary className="source-snippet__summary">
            <span className="summary-label">
              <AppIcon name="source" className="button-icon button-icon--sm" />
              Show original model draft
            </span>
          </summary>
          <p className="source-snippet__body">{attachment.rawDemoOutput}</p>
        </details>
      ) : null}
    </div>
  )
}

function canReviewExtractedText(attachment: UploadedAttachment) {
  return Boolean(
    attachment.extractedText?.trim()
    && !attachment.documentDraft
    && (attachment.status === 'review_ready'
      || attachment.status === 'applied_to_text'
      || attachment.status === 'reference_only'
      || attachment.status === 'text_ready'),
  )
}

function TextAttachmentReviewDialog({
  attachment,
  onApply,
  onClose,
}: {
  attachment: UploadedAttachment
  onApply: (
    attachmentId: string,
    nextValue: string,
    mode: 'add' | 'dismiss' | 'replace',
  ) => void
  onClose: () => void
}) {
  const [draftText, setDraftText] = useState(
    () => attachment.reviewedText ?? attachment.extractedText ?? '',
  )
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const cleanedReviewText = formatAccommodationReviewText(draftText)
  const canCleanFormatting = cleanedReviewText !== draftText.trim()
  const canApplyExactFix =
    findText.trim().length > 0
    && replaceText.trim().length > 0
    && draftText.includes(findText)

  function applyExactFix() {
    if (!canApplyExactFix) {
      return
    }

    setDraftText((currentText) =>
      currentText.replace(findText, replaceText.trim()),
    )
    setFindText('')
    setReplaceText('')
  }

  return (
    <div className="review-overlay" role="presentation">
      <section
        aria-labelledby="review-dialog-title"
        aria-modal="true"
        className="review-dialog"
        role="dialog"
      >
        <div className="review-dialog__header">
          <div>
            <p className="eyebrow">Check the file</p>
            <h3 id="review-dialog-title">Check what we read from your file</h3>
          </div>
          <button
            aria-label="Close review"
            className="ghost-button"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <label className="textarea-label">
          <span className="field-label__title">What we read</span>
          <span className="field-label__help">
            Change only what you can clearly see in your file. Nothing is saved
            until you tap a button below.
          </span>
          <textarea
            className="textarea-input textarea-input--compact review-dialog__textarea"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
          />
        </label>

        {attachment.readContainsUnclearText ? (
          <p className="field-message field-message--warning">
            We could not read part of this file clearly. You will see spots
            marked like `[unclear]` or `[blank]`. Only fix them if you can read
            the real words in your file.
          </p>
        ) : null}

        <details className="review-fix-panel">
          <summary>Fix one word or phrase</summary>
          <p className="field-label__help">
            This swaps text that is already above for words you type. It will not
            add anything new or guess.
          </p>
          <div className="review-fix-panel__grid">
            <label className="field-label">
              <span className="field-label__title">Text to change</span>
              <input
                className="text-input"
                value={findText}
                onChange={(event) => setFindText(event.target.value)}
              />
            </label>
            <label className="field-label">
              <span className="field-label__title">Change it to</span>
              <input
                className="text-input"
                value={replaceText}
                onChange={(event) => setReplaceText(event.target.value)}
              />
            </label>
          </div>
          <button
            className="ghost-button"
            disabled={!canApplyExactFix}
            type="button"
            onClick={applyExactFix}
          >
            Make this change
          </button>
        </details>

        <div className="screen-actions screen-actions--split">
          <button
            className="ghost-button"
            type="button"
            disabled={!canCleanFormatting}
            onClick={() => setDraftText(cleanedReviewText)}
          >
            Tidy up spacing
          </button>

          <button
            className="ghost-button"
            type="button"
            disabled={!draftText.trim()}
            onClick={() => {
              onApply(attachment.id, draftText, 'add')
              onClose()
            }}
          >
            Add to what I have
          </button>

          <button
            className="action-button"
            type="button"
            disabled={!draftText.trim()}
            onClick={() => {
              onApply(attachment.id, draftText, 'replace')
              onClose()
            }}
          >
            Use this
          </button>

          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              onApply(attachment.id, draftText, 'dismiss')
              onClose()
            }}
          >
            Cancel
          </button>
        </div>
      </section>
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
        <h3>What we found in your IEP</h3>
        <p className="field-label__help">
          Check the supports below. Fix anything that does not match your file,
          then tap Use this.
        </p>
      </div>

      <details className="optional-panel">
        <summary className="optional-panel__summary">
          <span className="summary-label">
            <AppIcon name="notebook" className="button-icon button-icon--sm" />
            Name and dates on the form
          </span>
          <span className="meta-badge">You can skip this</span>
        </summary>
        <div className="optional-panel__body">
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
              <span className="field-label__title">Date of birth</span>
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
        </div>
      </details>

      <label className="textarea-label">
        <span className="field-label__title">How you learn (if your IEP shows it)</span>
        <span className="field-label__help">
          Leave this empty if your file does not clearly show it.
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
            These IEP details are added and being used.
          </p>
        ) : (
          <button
            className="action-button"
            type="button"
            onClick={() => onUseAttachmentSource(attachment.id)}
          >
            Use this
          </button>
        )}

        <button
          className="ghost-button"
          type="button"
          onClick={() => onKeepAttachmentReference(attachment.id)}
        >
          Don't use this file
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
  function updateFollowUpAnswer(index: number, answer: string) {
    onAttachmentDocumentDraftChange(attachment.id, {
      ...draft,
      followUpQuestions: draft.followUpQuestions.map((item, itemIndex) =>
        itemIndex === index
          ? formatFollowUpAnswer(getFollowUpQuestionText(item), answer)
          : item,
      ),
    })
  }

  return (
    <div className="attachment-review">
      <div className="results-detail-block">
        <h3>What we found in this file</h3>
        <p className="field-label__help">
          Check the details below. Fix anything that looks wrong, then tap Use this.
        </p>
      </div>

      <label className="field-label">
        <span className="field-label__title">What is this?</span>
        <span className="field-label__help">
          Pick what this file shows.
        </span>
        <select
          className="text-input"
          value={draft.visibleDocumentType}
          onChange={(event) =>
            onAttachmentDocumentDraftChange(attachment.id, {
              ...draft,
              visibleDocumentType: event.target.value as TaskReviewDraft['visibleDocumentType'],
            })
          }
        >
          <option value="assignment_details">An assignment</option>
          <option value="assignment_page">An assignment page</option>
          <option value="rubric">A grading rubric</option>
          <option value="worksheet">A worksheet</option>
          <option value="quiz">A quiz</option>
          <option value="test">A test</option>
          <option value="unknown">Not sure</option>
        </select>
      </label>

      <label className="textarea-label">
        <span className="field-label__title">What does this work ask you to do?</span>
        <span className="field-label__help">
          Say what the work asks. Do not add your answers.
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
          <span className="field-label__title">Is there a time limit?</span>
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
            <option value="timed">Yes, it is timed</option>
            <option value="untimed">No time limit</option>
            <option value="unknown">Not sure</option>
          </select>
        </label>

        {draft.timedStatus === 'timed' ? (
          <label className="field-label">
            <span className="field-label__title">How many minutes?</span>
            <span className="field-label__help">
              Leave blank if you are not sure.
            </span>
            <input
              className="text-input"
              min="1"
              placeholder="30"
              type="number"
              value={draft.timeLimitMinutes ?? ''}
              onChange={(event) =>
                onAttachmentDocumentDraftChange(attachment.id, {
                  ...draft,
                  timeLimitMinutes: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </label>
        ) : null}
      </div>

      <details className="optional-panel">
        <summary className="optional-panel__summary">
          <span className="summary-label">
            <AppIcon name="results" className="button-icon button-icon--sm" />
            What else we picked up
          </span>
          <span className="meta-badge">Just so you can see</span>
        </summary>
        <div className="optional-panel__body">
          <p className="field-label__help">
            We use these notes to match your supports. You do not need to change
            them.
          </p>
          <dl className="review-readout">
            {draft.subject.trim() ? (
              <div className="review-readout__row">
                <dt>Subject</dt>
                <dd>{draft.subject}</dd>
              </div>
            ) : null}
            {draft.topic.trim() ? (
              <div className="review-readout__row">
                <dt>Topic</dt>
                <dd>{draft.topic}</dd>
              </div>
            ) : null}
            {draft.accessRelevantDetails.length > 0 ? (
              <div className="review-readout__row">
                <dt>Details that may matter</dt>
                <dd>{formatBullets(draft.accessRelevantDetails)}</dd>
              </div>
            ) : null}
            {draft.evidenceBullets.length > 0 ? (
              <div className="review-readout__row">
                <dt>What we saw on the page</dt>
                <dd>{formatBullets(draft.evidenceBullets)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </details>

      {draft.followUpQuestions.length > 0 ? (
        <div className="follow-up-answer-list">
          <div>
            <h3>A few quick questions</h3>
            <p className="field-label__help">
              Answer what you can. Skip anything you are not sure about.
            </p>
          </div>

          {draft.followUpQuestions.map((item, index) => {
            const question = getFollowUpQuestionText(item)
            const answer = getFollowUpAnswer(item)
            const accommodationFocusQuestion = isAccommodationFocusQuestion(question)
            const yesNoQuestion = isYesNoQuestion(question)

            return (
              <div key={`${question}-${index}`} className="follow-up-answer">
                <p className="follow-up-answer__prompt">{question}</p>

                {accommodationFocusQuestion ? (
                  <div className="segmented-group follow-up-answer__choices follow-up-answer__choices--wrap">
                    {['Practice work', 'Quiz/test', 'Both'].map((choice) => (
                      <button
                        key={choice}
                        className={`segmented-choice${
                          answer.toLowerCase() === choice.toLowerCase()
                            ? ' segmented-choice--active'
                            : ''
                        }`}
                        type="button"
                        onClick={() =>
                          updateFollowUpAnswer(
                            index,
                            answer.toLowerCase() === choice.toLowerCase()
                              ? ''
                              : choice,
                          )
                        }
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                ) : yesNoQuestion ? (
                  <div className="segmented-group follow-up-answer__choices">
                    {['Yes', 'No'].map((choice) => (
                      <button
                        key={choice}
                        className={`segmented-choice${
                          answer.toLowerCase() === choice.toLowerCase()
                            ? ' segmented-choice--active'
                            : ''
                        }`}
                        type="button"
                        onClick={() =>
                          updateFollowUpAnswer(
                            index,
                            answer.toLowerCase() === choice.toLowerCase()
                              ? ''
                              : choice,
                          )
                        }
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    className="text-input"
                    placeholder="Add answer"
                    value={answer}
                    onChange={(event) =>
                      updateFollowUpAnswer(index, event.target.value)
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      {renderRawTranscript(attachment.rawTranscript)}

      <div className="screen-actions screen-actions--split">
        {attachment.status === 'included' ? (
          <p className="field-message">
            These school work details are added and being used.
          </p>
        ) : (
          <button
            className="action-button"
            type="button"
            onClick={() => onUseAttachmentSource(attachment.id)}
          >
            Use this
          </button>
        )}

        <button
          className="ghost-button"
          type="button"
          onClick={() => onKeepAttachmentReference(attachment.id)}
        >
          Don't use this file
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
        <span className="field-label__title">What is in this file?</span>
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
        <span className="field-label__title">What we saw on the page</span>
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
            These file notes are added and being used.
          </p>
        ) : (
          <button
            className="action-button"
            type="button"
            onClick={() => onUseAttachmentSource(attachment.id)}
          >
            Use this
          </button>
        )}

        <button
          className="ghost-button"
          type="button"
          onClick={() => onKeepAttachmentReference(attachment.id)}
        >
          Don't use this file
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
  onApplyAttachmentTextReview,
  onAttachmentDocumentDraftChange,
  onChooseFiles,
  onKeepAttachmentReference,
  onApplyDemoAccommodationCorrection,
  onApplyDemoRecordedRun,
  onRemoveAttachment,
  onRunAttachmentInterpretation,
  onTextChange,
  onUseAttachmentSource,
  textFootnote,
  textHelp,
  textLabel,
  textName,
  textPlaceholder,
  textRequired = false,
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
  const hasRunningInterpretation = attachments.some(
    (attachment) => attachment.status === 'interpret_running',
  )
  const showUploadPanel = attachments.length > 0
  const [now, setNow] = useState(() => Date.now())
  const [requestedTextReviewId, setRequestedTextReviewId] = useState<string | null>(null)
  const [dismissedTextReviewIds, setDismissedTextReviewIds] = useState<Set<string>>(
    () => new Set(),
  )
  const requestedTextReviewAttachment = attachments.find(
    (attachment) =>
      attachment.id === requestedTextReviewId && canReviewExtractedText(attachment),
  )
  const automaticTextReviewAttachment = attachments.find(
    (attachment) =>
      attachment.status === 'review_ready'
      && canReviewExtractedText(attachment)
      && !dismissedTextReviewIds.has(attachment.id),
  )
  const activeTextReviewAttachment =
    requestedTextReviewAttachment || automaticTextReviewAttachment

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

  useEffect(() => {
    if (!hasRunningInterpretation) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [hasRunningInterpretation])

  function closeTextReview() {
    if (activeTextReviewAttachment) {
      setDismissedTextReviewIds((currentIds) =>
        new Set(currentIds).add(activeTextReviewAttachment.id),
      )
    }

    setRequestedTextReviewId(null)
  }

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
          {textRequired ? (
            <span className="field-required-pill">Needed</span>
          ) : null}
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
          Listening. Your words show up here as you speak. Tap the button again to stop.
        </p>
      ) : null}

      {textValue.trim() ? (
        <p className="field-message">
          {countLines(textValue)} {countLines(textValue) === 1 ? 'line' : 'lines'} added.
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
            {reviewedSourceCount === 1 ? 'file is' : 'files are'} added and being
            used.
          </p>
        ) : null}

        {pendingReviewCount > 0 ? (
          <p className="field-message field-message--hint">
            {pendingReviewCount}{' '}
            {pendingReviewCount === 1
              ? 'file still needs a quick check'
              : 'files still need a quick check'}{' '}
            before it can be used.
          </p>
        ) : null}

        {attachments.some(
          (attachment) => attachment.kind === 'image' || attachment.kind === 'pdf',
        ) ? (
          <div className="field-message field-message--status-list">
            {getDocumentReadingStatusMessages(documentPlan).map((message) => (
              <p key={message}>{message}</p>
            ))}
            {documentPlan.isRemote ? (
              <p>
                Choosing the endpoint action sends the file image to your configured
                model endpoint so it can build reviewable text or a structured task
                draft.
              </p>
            ) : null}
          </div>
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
              const interpretationAction = getAttachmentInterpretationAction(
                attachment,
                documentPlan,
              )
              const canOpenTextReview = canReviewExtractedText(attachment)
              const recordedRun =
                onApplyDemoRecordedRun && attachment.isDemoSeed
                  ? getJordanDemoRecordedRun(attachment.id)
                  : null
              const canApplyRecordedRun = Boolean(
                recordedRun
                && attachment.status === 'interpret_ready'
                && !interpretationAction.canInterpret,
              )
              const canApplyDemoCorrection = Boolean(
                onApplyDemoAccommodationCorrection
                && attachment.isDemoSeed
                && attachment.id === 'demo-jordan-iep-snapshot'
                && !attachment.demoCorrectionSource
                && (attachment.status === 'review_ready' || attachment.status === 'failed')
                && (attachment.readMethod || attachment.readError),
              )

              return (
                <article key={attachment.id} className="attachment-card">
                  <div className="attachment-card__header">
                    {attachment.previewUrl ? (
                      <div className="attachment-card__inline-preview">
                        <img src={attachment.previewUrl} alt={`Preview of ${attachment.name}`} />
                      </div>
                    ) : null}

                    <div className="attachment-card__heading-copy">
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
                    {interpretationAction.canInterpret ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => void onRunAttachmentInterpretation(attachment.id)}
                      >
                        {interpretationAction.label}
                      </button>
                    ) : null}

                    {interpretationAction.note ? (
                      <p className="attachment-card__model-note">
                        {interpretationAction.note}
                      </p>
                    ) : null}

                    {canApplyRecordedRun && recordedRun ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => onApplyDemoRecordedRun?.(attachment.id)}
                      >
                        Use a previous local Gemma run (took{' '}
                        {formatElapsedTime(recordedRun.elapsedMs)})
                      </button>
                    ) : null}

                    {canApplyDemoCorrection ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          onApplyDemoAccommodationCorrection?.(attachment.id)
                          setRequestedTextReviewId(attachment.id)
                        }}
                      >
                        Apply demo correction
                      </button>
                    ) : null}

                    {canOpenTextReview ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setRequestedTextReviewId(attachment.id)}
                      >
                        Check the text we found
                      </button>
                    ) : null}

                    {attachment.status !== 'reference_only' ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => onKeepAttachmentReference(attachment.id)}
                      >
                        Don't use this file
                      </button>
                    ) : null}
                  </div>

                  <InterpretationProgressStatus attachment={attachment} now={now} />

                  <DemoDraftProvenance attachment={attachment} />

                  {attachment.notes.length > 0 ? (
                    <ul className="attachment-card__notes">
                      {attachment.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}

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
      {activeTextReviewAttachment ? (
        <TextAttachmentReviewDialog
          key={activeTextReviewAttachment.id}
          attachment={activeTextReviewAttachment}
          onApply={onApplyAttachmentTextReview}
          onClose={closeTextReview}
        />
      ) : null}
    </div>
  )
}
