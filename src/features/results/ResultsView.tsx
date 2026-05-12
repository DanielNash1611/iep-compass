import { AppIcon } from '../../components/AppIcon'
import { ConfidenceBadge } from '../../components/ConfidenceBadge'
import { SectionCard } from '../../components/SectionCard'
import type { AnalysisExecution } from '../../types/analysis'

const ACCOMMODATION_SUPPORT_COPY = {
  likely_relevant: 'Worth checking early for this task.',
  possibly_relevant: 'May fit, but the match is less settled.',
  unclear_confirm: 'Pause here and confirm the boundary first.',
} as const

const CONFIRMATION_COPY = {
  likely_relevant:
    'This looks like a strong match, but it still helps to confirm the logistics before the task starts.',
  possibly_relevant:
    'This may fit, but the task details do not fully settle it yet. A quick check with staff can clarify how it should be used here.',
  unclear_confirm:
    'The source trail leaves an important boundary unresolved here, so this one needs confirmation before anyone relies on it.',
} as const

interface ResultsViewProps {
  analysis: AnalysisExecution
  onAskAboutAccommodation?: (
    item: AnalysisExecution['result']['notObviouslyRelevant'][number],
  ) => void
}

interface SupportGroup {
  description: string
  eyebrow: string
  items: AnalysisExecution['result']['relevantAccommodations']
  title: string
  tone: 'accent' | 'soft'
}

function formatSupportCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function buildSupportGroups(
  analysis: AnalysisExecution,
): SupportGroup[] {
  const checkFirst = analysis.result.relevantAccommodations.filter(
    (item) => item.confidence === 'likely_relevant',
  )
  const worthConfirming = analysis.result.relevantAccommodations.filter(
    (item) => item.confidence !== 'likely_relevant',
  )

  return [
    {
      eyebrow: 'Check first',
      title: 'Most likely to help on this task',
      description:
        'These look like the clearest connections between the task and the approved accommodations in the source trail.',
      items: checkFirst,
      tone: 'accent',
    },
    {
      eyebrow: 'Worth confirming',
      title: 'Could fit, but still needs a check',
      description:
        'These may still matter, but the task details or accommodation boundary need a little more context first.',
      items: worthConfirming,
      tone: 'soft',
    },
  ]
}

function buildAccommodationScript(name: string) {
  return `I think my approved accommodation for ${name} may fit this task. Can we check how I should use it before I start?`
}

function buildAlternativeAccommodationScripts(name: string) {
  return [
    `Can I use my ${name} accommodation for this task?`,
    `Could we look at my IEP wording for ${name} and decide how it applies here?`,
  ]
}

export function ResultsView({ analysis, onAskAboutAccommodation }: ResultsViewProps) {
  const supportGroups = buildSupportGroups(analysis)
  const likelyCount = supportGroups[0].items.length
  const confirmCount = supportGroups[1].items.length
  const studentGuidance = analysis.result.studentGuidance
  const adultCoachNotes =
    analysis.result.parentGuidance.coachNotes.length > 0
      ? analysis.result.parentGuidance.coachNotes
      : ['Help the student stay in the lead when asking for an accommodation.']
  const staffCheckNotes =
    analysis.result.teacherGuidance.staffNotes.length > 0
      ? analysis.result.teacherGuidance.staffNotes
      : ['Keep the accommodation tied to the approved IEP wording and confirm the setup first.']

  return (
    <div className="results-stack">
      <SectionCard
        eyebrow="Start here"
        title="Start with the student view"
        description="This page starts with the student path first: the clearest matches, the items to confirm, and the words to use next."
        tone="accent"
        icon={<AppIcon name="compass" />}
      >
        <div className="results-overview">
          <p className="results-priority-note">
            {studentGuidance.startHere}
          </p>

          <div className="results-meta results-meta--summary" aria-label="Result summary">
            <span className="meta-badge">
              {formatSupportCount(likelyCount, 'strong match', 'strong matches')}
            </span>
            <span className="meta-badge">
              {formatSupportCount(confirmCount, 'item to confirm', 'items to confirm')}
            </span>
            <span className="meta-badge">
              {analysis.meta.mode === 'live' ? analysis.meta.runtimeLabel : 'Demo mode'}
            </span>
          </div>
        </div>
      </SectionCard>

      {analysis.result.relevantAccommodations.length === 0 ? (
        <SectionCard
          eyebrow="No clear match yet"
          title="Nothing stands out as a strong fit yet"
          description="That usually means the task details need a little more context or the connection is still too uncertain to call."
          icon={<AppIcon name="waypoint" />}
          tone="soft"
        >
          <div className="results-empty-state">
            <span className="results-empty-state__icon" aria-hidden="true">
              <AppIcon name="waypoint" />
            </span>
            <div>
              <h3>Try tightening the task details</h3>
              <p>
                Add a little more about the directions, timing, or task format, then
                run the accommodation map again.
              </p>
            </div>
          </div>

          {analysis.result.notObviouslyRelevant.length > 0 ? (
            <div className="skipped-accommodation-list">
              <div className="results-detail-block">
                <h3>Want to ask about one anyway?</h3>
                <p>
                  These are approved accommodations from the source trail, but this
                  pass did not have enough task evidence to connect them clearly.
                </p>
              </div>

              {analysis.result.notObviouslyRelevant.map((item, index) => (
                <article
                  className="skipped-accommodation-card"
                  key={`${item.name}-${index}`}
                >
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.reason}</p>
                  </div>

                  {onAskAboutAccommodation ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onAskAboutAccommodation(item)}
                    >
                      <AppIcon name="quote" className="button-icon" />
                      Ask about this
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {supportGroups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <SectionCard
            key={group.eyebrow}
            eyebrow={group.eyebrow}
            title={group.title}
            description={group.description}
            tone={group.tone}
            icon={<AppIcon name={group.eyebrow === 'Check first' ? 'star' : 'waypoint'} />}
          >
            <div className="accommodation-list">
              {group.items.map((item, index) => (
                <article
                  key={`${item.name}-${item.sourceText}`}
                  className={`accommodation-card accommodation-card--${item.confidence}`}
                >
                  <div className="accommodation-card__topline">
                    <span className="accommodation-card__waypoint">
                      <AppIcon name="star" className="button-icon button-icon--sm" />
                      {group.eyebrow === 'Check first'
                        ? `Start with ${index + 1}`
                        : `Confirm ${index + 1}`}
                    </span>
                    <ConfidenceBadge confidence={item.confidence} />
                  </div>

                  <div className="accommodation-card__header">
                    <div>
                      <h3>{item.name}</h3>
                      <p className="accommodation-card__summary">{item.plainLanguage}</p>
                    </div>
                  </div>

                  <div className="accommodation-columns">
                    <section className="accommodation-pane accommodation-pane--why">
                      <h4>
                        <AppIcon name="results" className="button-icon button-icon--sm" />
                        <span>Why it may apply</span>
                      </h4>
                      <p>{item.applicationReason}</p>
                      <p>{item.whyItMayMatter}</p>
                    </section>

                    <section className="accommodation-pane accommodation-pane--action">
                      <h4>
                        <AppIcon name="flag" className="button-icon button-icon--sm" />
                        <span>What to do next</span>
                      </h4>
                      {item.implementationNotes.length > 0 ? (
                        <ul className="support-list support-list--checks">
                          {item.implementationNotes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>{ACCOMMODATION_SUPPORT_COPY[item.confidence]}</p>
                      )}
                    </section>

                    <section className="accommodation-pane accommodation-pane--confirm">
                      <h4>
                        <AppIcon name="waypoint" className="button-icon button-icon--sm" />
                        <span>What needs confirmation</span>
                      </h4>
                      <p>{CONFIRMATION_COPY[item.confidence]}</p>
                    </section>

                    <section className="accommodation-pane accommodation-pane--script">
                      <h4>
                        <AppIcon name="quote" className="button-icon button-icon--sm" />
                        <span>What to say</span>
                      </h4>
                      <blockquote className="quote-card quote-card--inline">
                        <p>{buildAccommodationScript(item.name)}</p>
                      </blockquote>
                      <details className="script-options">
                        <summary>Other ways to say it</summary>
                        <ul className="support-list">
                          {buildAlternativeAccommodationScripts(item.name).map((script) => (
                            <li key={script}>{script}</li>
                          ))}
                        </ul>
                      </details>
                    </section>
                  </div>

                  <details className="source-snippet">
                    <summary className="source-snippet__summary">
                      <span className="summary-label">
                        <AppIcon name="source" className="button-icon button-icon--sm" />
                        Show source text
                      </span>
                    </summary>

                    <p className="source-snippet__body">{item.sourceText}</p>
                  </details>
                </article>
              ))}
            </div>
          </SectionCard>
        ))}

      <div className="results-sidecar-grid">
        <SectionCard
          eyebrow="If a grown-up is helping"
          title="Coach notes for a parent or guardian"
          description="These notes help an adult back the student up without taking over the student’s voice."
          tone="soft"
          icon={<AppIcon name="shield" />}
          className="results-sidecar-card"
        >
          <p className="results-sidecar-card__note">
            {analysis.result.parentGuidance.summary}
          </p>

          <ul className="support-list support-list--checks">
            {adultCoachNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          eyebrow="What school staff may want to check"
          title="Staff notes for setup and access"
          description="These reminders stay on access and setup, not on doing the task for the student."
          tone="soft"
          icon={<AppIcon name="waypoint" />}
          className="results-sidecar-card"
        >
          <p className="results-sidecar-card__note">
            {analysis.result.teacherGuidance.summary}
          </p>

          <ul className="support-list support-list--checks">
            {staffCheckNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Deeper review"
        title="Reasoning trail and boundaries"
        description="Open this only if you want the model notes, lower-priority items, or the boundaries that stayed in place."
        tone="soft"
        icon={<AppIcon name="results" />}
      >
        <details className="results-details-panel">
          <summary className="results-details-panel__summary">
            <span className="summary-label">
              <AppIcon name="compass" className="button-icon button-icon--sm" />
              Open the deeper review
            </span>
          </summary>

          <div className="results-details-panel__body">
            <div className="results-meta" aria-label="Analysis metadata">
              <span className="meta-badge">{analysis.meta.model}</span>
              {analysis.meta.usedFallback ? (
                <span className="meta-badge">Fallback path used</span>
              ) : null}
            </div>

            {analysis.meta.notes.length > 0 ? (
              <div className="results-detail-block">
                <h3>Model notes</h3>
                <ul className="support-list">
                  {analysis.meta.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="results-detail-block">
              <h3>Not obviously relevant here</h3>
              {analysis.result.notObviouslyRelevant.length > 0 ? (
                <ul className="support-list">
                  {analysis.result.notObviouslyRelevant.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      <strong>{item.name}:</strong> {item.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Every accommodation in the excerpt either looked relevant here or needed a
                  confirmation note.
                </p>
              )}
            </div>

            <div className="results-detail-block">
              <h3>Boundaries that stayed in place</h3>
              <ul className="support-list support-list--checks">
                {analysis.result.boundaries.map((boundary) => (
                  <li key={boundary}>{boundary}</li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      </SectionCard>
    </div>
  )
}
