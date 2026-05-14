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
    case 'applied_to_text':
      return 'Added to approved wording'
    case 'text_ready':
      return 'Text ready'
    case 'interpret_ready':
      return attachment.kind === 'image' ? 'Ready as reference' : 'Ready to interpret'
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
          Show raw transcript
        </span>
      </summary>

      <p className="source-snippet__body">{rawTranscript}</p>
    </details>
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
            <p className="eyebrow">Review upload text</p>
            <h3 id="review-dialog-title">Check extracted accommodations</h3>
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
          <span className="field-label__title">Extracted text</span>
          <span className="field-label__help">
            Edit only what you can confirm from the uploaded document. The approved
            wording field behind this overlay is the source of truth after you apply.
          </span>
          <textarea
            className="textarea-input textarea-input--compact review-dialog__textarea"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
          />
        </label>

        {attachment.readContainsUnclearText ? (
          <p className="field-message field-message--warning">
            This extraction includes at least one uncertain placeholder such as
            `[unclear]`, `[blank]`, or `[redacted]`. Keep those spots cautious unless
            you can confirm the exact wording.
          </p>
        ) : null}

        <details className="review-fix-panel">
          <summary>Fix one detail</summary>
          <p className="field-label__help">
            This only replaces exact text already in the draft with wording you type.
            It will not create a new accommodation or guess missing text.
          </p>
          <div className="review-fix-panel__grid">
            <label className="field-label">
              <span className="field-label__title">Text to replace</span>
              <input
                className="text-input"
                value={findText}
                onChange={(event) => setFindText(event.target.value)}
              />
            </label>
            <label className="field-label">
              <span className="field-label__title">Use this exact wording</span>
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
            Apply exact fix
          </button>
        </details>

        <div className="screen-actions screen-actions--split">
          <button
            className="ghost-button"
            type="button"
            disabled={!canCleanFormatting}
            onClick={() => setDraftText(cleanedReviewText)}
          >
            Clean up formatting
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
            Add to existing
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
            Update approved wording
          </button>

          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              onApply(attachment.id, draftText, 'dismiss')
              onClose()
            }}
          >
            Do not use
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
      <label className="field-label">
        <span className="field-label__title">Visible document kind</span>
        <span className="field-label__help">
          Choose what this upload appears to show, not what might be on another page.
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
          <option value="assignment_details">Assignment details</option>
          <option value="assignment_page">Assignment page</option>
          <option value="rubric">Rubric</option>
          <option value="worksheet">Worksheet</option>
          <option value="quiz">Quiz</option>
          <option value="test">Test</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>

      <label className="textarea-label">
        <span className="field-label__title">Task description</span>
        <span className="field-label__help">
          Keep this focused on the kind of work shown. Do not include answers.
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
          <span className="field-label__title">Accommodation focus</span>
          <span className="field-label__help">
            Choose what the accommodation check should be about.
          </span>
          <select
            className="text-input"
            value={draft.accommodationFocus}
            onChange={(event) =>
              onAttachmentDocumentDraftChange(attachment.id, {
                ...draft,
                accommodationFocus: event.target.value as TaskReviewDraft['accommodationFocus'],
              })
            }
          >
            <option value="practice">Practice</option>
            <option value="quiz">Quiz</option>
            <option value="test">Test</option>
            <option value="assignment">Assignment</option>
            <option value="unknown">Not sure yet</option>
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
          <span className="field-label__title">Minutes</span>
          <span className="field-label__help">
            Leave blank if the time limit is not confirmed.
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
        <span className="field-label__title">Access-relevant visible details</span>
        <span className="field-label__help">
          Add details that may affect accommodations, such as timing, rubric categories,
          writing load, reading load, steps, materials, or calculation focus.
        </span>
        <textarea
          className="textarea-input textarea-input--compact"
          rows={4}
          value={formatBullets(draft.accessRelevantDetails)}
          onChange={(event) =>
            onAttachmentDocumentDraftChange(attachment.id, {
              ...draft,
              accessRelevantDetails: parseBullets(event.target.value),
            })
          }
        />
      </label>

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

      {draft.followUpQuestions.length > 0 ? (
        <div className="follow-up-answer-list">
          <div>
            <h3>Check before you use this</h3>
            <p className="field-label__help">
              Answer what you can. Leave anything unclear blank for now.
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

          <details className="review-fix-panel">
            <summary>Edit prompts</summary>
            <textarea
              className="textarea-input textarea-input--compact"
              rows={4}
              value={formatBullets(draft.followUpQuestions.map(getFollowUpQuestionText))}
              onChange={(event) =>
                onAttachmentDocumentDraftChange(attachment.id, {
                  ...draft,
                  followUpQuestions: parseBullets(event.target.value),
                })
              }
            />
          </details>
        </div>
      ) : null}

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
  onApplyAttachmentTextReview,
  onAttachmentDocumentDraftChange,
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

                    {canOpenTextReview ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setRequestedTextReviewId(attachment.id)}
                      >
                        Review extracted text
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

                  <InterpretationProgressStatus attachment={attachment} now={now} />

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
