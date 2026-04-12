import { ConfidenceBadge } from '../../components/ConfidenceBadge'
import { SectionCard } from '../../components/SectionCard'
import type { AnalysisExecution, Role } from '../../types/analysis'

const ROLE_LEADS: Record<Role, { description: string; title: string }> = {
  student: {
    title: 'Student focus',
    description:
      'Lead with the likely supports and the advocacy script you can use before the task begins.',
  },
  parent: {
    title: 'Parent focus',
    description:
      'Use this to coach the student, preview possible supports, and decide what to confirm with school staff.',
  },
  teacher: {
    title: 'Teacher focus',
    description:
      'Use this as a reminder of which approved supports may matter here and where staff confirmation is still needed.',
  },
}

interface ResultsViewProps {
  analysis: AnalysisExecution
  isStale: boolean
  role: Role
}

export function ResultsView({
  analysis,
  isStale,
  role,
}: ResultsViewProps) {
  const roleLead = ROLE_LEADS[role]
  const remindersFirst = role === 'teacher'

  const advocacyPanel = (
    <SectionCard
      key="advocacy"
      eyebrow="Student advocacy"
      title="Respectful language to ask for support"
      description="These scripts stay focused on approved supports rather than asking for academic help."
    >
      <div className="stacked-copy">
        <blockquote className="quote-card">
          <p>{analysis.result.studentAdvocacy.suggestedScript}</p>
        </blockquote>

        {analysis.result.studentAdvocacy.alternativeScripts.length > 0 ? (
          <ul className="support-list">
            {analysis.result.studentAdvocacy.alternativeScripts.map((script) => (
              <li key={script}>{script}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </SectionCard>
  )

  const teacherPanel = (
    <SectionCard
      key="teacher"
      eyebrow="Teacher reminders"
      title="Implementation notes to keep the support grounded"
      description="These reminders emphasize access supports and clear confirmation points."
    >
      <ul className="support-list">
        {analysis.result.teacherReminders.map((reminder) => (
          <li key={reminder}>{reminder}</li>
        ))}
      </ul>
    </SectionCard>
  )

  return (
    <div className="results-stack">
      <SectionCard
        eyebrow="Analysis summary"
        title="What may matter for this task"
        description={analysis.result.summary}
        tone="accent"
      >
        <div className="role-callout">
          <span className="eyebrow">{roleLead.title}</span>
          <p>{roleLead.description}</p>
        </div>

        <div className="results-meta" aria-label="Analysis metadata">
          <span className="meta-badge">
            {analysis.meta.mode === 'remote' ? 'Gemma live' : 'Demo mode'}
          </span>
          <span className="meta-badge">{analysis.meta.model}</span>
          {analysis.meta.usedFallback ? (
            <span className="meta-badge">Fallback path used</span>
          ) : null}
        </div>

        {analysis.meta.notes.length > 0 ? (
          <ul className="support-list">
            {analysis.meta.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}

        {isStale ? (
          <div className="status-banner">
            The input changed after this result was generated. Refresh the analysis
            before sharing it with a student, parent, or teacher.
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        eyebrow="Potentially relevant accommodations"
        title="Supports from the excerpt that may apply here"
        description="Confidence stays cautious when the task details are incomplete or the accommodation depends on what the task is measuring."
      >
        {analysis.result.relevantAccommodations.length > 0 ? (
          <div className="accommodation-list">
            {analysis.result.relevantAccommodations.map((item) => (
              <article key={`${item.name}-${item.sourceText}`} className="accommodation-card">
                <div className="accommodation-card__header">
                  <h3>{item.name}</h3>
                  <ConfidenceBadge confidence={item.confidence} />
                </div>

                <div className="accommodation-details">
                  <div>
                    <dt>Plain language</dt>
                    <dd>{item.plainLanguage}</dd>
                  </div>

                  <div>
                    <dt>Why it may matter</dt>
                    <dd>{item.whyItMayMatter}</dd>
                  </div>

                  <div>
                    <dt>Source text from the IEP excerpt</dt>
                    <dd>{item.sourceText}</dd>
                  </div>
                </div>

                {item.implementationNotes.length > 0 ? (
                  <ul className="support-list">
                    {item.implementationNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p>
            No accommodations from the pasted excerpt stand out as clearly relevant
            from the current task description. That usually means the task details
            are incomplete or the connection is not obvious yet.
          </p>
        )}
      </SectionCard>

      {remindersFirst ? teacherPanel : advocacyPanel}
      {remindersFirst ? advocacyPanel : teacherPanel}

      <SectionCard
        eyebrow="Not obviously relevant"
        title="Supports that do not clearly connect yet"
        description="Keeping these separate helps the app avoid overclaiming."
        tone="soft"
      >
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
            Every accommodation in the excerpt either appeared relevant here or
            required an uncertainty note.
          </p>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Boundaries"
        title="Safety notes and scope"
        description="These reminders keep the output grounded in the PRD rules."
      >
        <ul className="support-list">
          {analysis.result.boundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
