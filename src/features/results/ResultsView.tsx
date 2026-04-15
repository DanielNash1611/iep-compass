import { AppIcon } from '../../components/AppIcon'
import { ConfidenceBadge } from '../../components/ConfidenceBadge'
import { SectionCard } from '../../components/SectionCard'
import type { AnalysisExecution, Role } from '../../types/analysis'

const ROLE_LEADS: Record<Role, { description: string; title: string }> = {
  student: {
    title: 'Student focus',
    description:
      'Lead with the support that seems most useful here and the words a student can use to ask for it.',
  },
  parent: {
    title: 'Parent focus',
    description:
      'Use this to coach the student, preview what may help, and decide what is worth confirming with school staff.',
  },
  teacher: {
    title: 'Teacher focus',
    description:
      'Use this as a grounded reminder of which approved supports may matter and what still needs confirmation.',
  },
}

const ACCOMMODATION_SUPPORT_COPY = {
  likely_relevant: 'Worth checking first for this assignment.',
  possibly_relevant: 'Could help, but the fit is less certain.',
  unclear_confirm: 'Pause here and confirm the details with staff.',
} as const

interface ResultsViewProps {
  analysis: AnalysisExecution
  role: Role
}

export function ResultsView({ analysis, role }: ResultsViewProps) {
  const roleLead = ROLE_LEADS[role]
  const remindersFirst = role === 'teacher'

  const advocacyPanel = (
    <SectionCard
      key="advocacy"
      eyebrow="Student advocacy"
      title="Words you can use to ask for support"
      description="These scripts stay focused on approved supports and keep the ask respectful and specific."
      icon={<AppIcon name="quote" />}
    >
      <div className="stacked-copy">
        <blockquote className="quote-card quote-card--featured">
          <p>{analysis.result.studentAdvocacy.suggestedScript}</p>
        </blockquote>

        {analysis.result.studentAdvocacy.alternativeScripts.length > 0 ? (
          <div className="results-detail-block">
            <h3>Other ways to say it</h3>
            <ul className="support-list">
              {analysis.result.studentAdvocacy.alternativeScripts.map((script) => (
                <li key={script}>{script}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SectionCard>
  )

  const teacherPanel = (
    <SectionCard
      key="teacher"
      eyebrow="Teacher reminders"
      title="Helpful implementation notes"
      description="These notes keep the support grounded in access, not in doing the academic work for the student."
      icon={<AppIcon name="shield" />}
    >
      <ul className="support-list support-list--checks">
        {analysis.result.teacherReminders.map((reminder) => (
          <li key={reminder}>{reminder}</li>
        ))}
      </ul>
    </SectionCard>
  )

  return (
    <div className="results-stack">
      <SectionCard
        eyebrow="Recommended first"
        title="Supports to check first"
        description={analysis.result.summary}
        tone="accent"
        icon={<AppIcon name="compass" />}
      >
        <p className="results-priority-note">
          Here&apos;s what may apply for this assignment. Each checkpoint shows
          the exact source text the app is using so the reasoning stays easy to
          follow.
        </p>

        {analysis.result.relevantAccommodations.length > 0 ? (
          <div className="accommodation-list">
            {analysis.result.relevantAccommodations.map((item, index) => {
              const detailBlocks = [
                {
                  icon: 'spark' as const,
                  label: 'What this support means',
                  value: item.plainLanguage,
                },
                {
                  icon: 'results' as const,
                  label: 'Why it may fit this assignment',
                  value: item.applicationReason,
                },
                {
                  icon: 'waypoint' as const,
                  label: 'Why it may help with access',
                  value: item.whyItMayMatter,
                },
                {
                  icon: 'source' as const,
                  label: 'Source text we relied on',
                  value: item.sourceText,
                },
              ]

              return (
                <article
                  key={`${item.name}-${item.sourceText}`}
                  className={`accommodation-card accommodation-card--${item.confidence}`}
                >
                  <div className="accommodation-card__topline">
                    <span className="accommodation-card__waypoint">
                      <AppIcon name="star" className="button-icon button-icon--sm" />
                      Checkpoint {index + 1}
                    </span>
                    <ConfidenceBadge confidence={item.confidence} />
                  </div>

                  <div className="accommodation-card__header">
                    <div>
                      <h3>{item.name}</h3>
                      <p className="accommodation-card__summary">
                        {ACCOMMODATION_SUPPORT_COPY[item.confidence]}
                      </p>
                    </div>
                  </div>

                  <dl className="accommodation-details">
                    {detailBlocks.map((detail) => (
                      <div
                        key={`${item.name}-${detail.label}`}
                        className={`accommodation-detail-card accommodation-detail-card--${detail.icon}`}
                      >
                        <dt>
                          <AppIcon name={detail.icon} className="button-icon button-icon--sm" />
                          <span>{detail.label}</span>
                        </dt>
                        <dd>{detail.value}</dd>
                      </div>
                    ))}
                  </dl>

                  {item.implementationNotes.length > 0 ? (
                    <div className="accommodation-card__notes">
                      <h4>
                        <AppIcon name="flag" className="button-icon button-icon--sm" />
                        <span>What to double-check next</span>
                      </h4>
                      <ul className="support-list support-list--checks">
                        {item.implementationNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="results-empty-state">
            <span className="results-empty-state__icon" aria-hidden="true">
              <AppIcon name="waypoint" />
            </span>
            <div>
              <h3>No clear support match yet</h3>
              <p>
                Nothing in the current excerpt stands out as a strong fit yet.
                That usually means the assignment details need a little more
                context or the connection is still too uncertain to call.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {remindersFirst ? teacherPanel : advocacyPanel}
      {remindersFirst ? advocacyPanel : teacherPanel}

      <SectionCard
        eyebrow="More detail"
        title="Why this output looks this way"
        description="Open this if you want to inspect the reasoning trail, model notes, and the boundaries that stayed in place."
        tone="soft"
        icon={<AppIcon name="results" />}
      >
        <details className="results-details-panel">
          <summary className="results-details-panel__summary">
            <span className="summary-label">
              <AppIcon name="compass" className="button-icon button-icon--sm" />
              Open the reasoning trail
            </span>
          </summary>

          <div className="results-details-panel__body">
            <div className="role-callout">
              <span className="eyebrow">{roleLead.title}</span>
              <p>{roleLead.description}</p>
            </div>

            <div className="results-meta" aria-label="Analysis metadata">
              <span className="meta-badge">
                {analysis.meta.mode === 'live'
                  ? analysis.meta.runtimeLabel
                  : 'Demo mode'}
              </span>
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
              <h3>Not obviously relevant</h3>
              {analysis.result.notObviouslyRelevant.length > 0 ? (
                <ul className="support-list">
                  {analysis.result.notObviouslyRelevant.map((item) => (
                    <li key={`${item.name}-${item.reason}`}>
                      <strong>{item.name}:</strong> {item.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Every accommodation in the excerpt either looked relevant here
                  or needed an uncertainty note.
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
