import { useId, useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import type { AppIconName } from '../../components/AppIcon'
import { ConfidenceBadge } from '../../components/ConfidenceBadge'
import { SectionCard } from '../../components/SectionCard'
import type { AnalysisExecution } from '../../types/analysis'

const ACCOMMODATION_SUPPORT_COPY = {
  likely_relevant: 'Check this one first.',
  possibly_relevant: 'This might help. Check with a teacher.',
  unclear_confirm: 'Ask a teacher before you count on this one.',
} as const

const CONFIRMATION_COPY = {
  likely_relevant:
    'This is a strong fit. It still helps to ask your teacher how to use it before you start.',
  possibly_relevant:
    'This might fit. A quick check with your teacher can tell you if it works here.',
  unclear_confirm:
    'We could not tell for sure from what you added. Ask a teacher before you count on this one.',
} as const

const CONFIDENCE_LEGEND: Array<{
  icon: 'check' | 'compass' | 'flag'
  label: string
  detail: string
}> = [
  { icon: 'check', label: 'Strong fit', detail: 'Looks like a good match for this work.' },
  { icon: 'compass', label: 'Might fit', detail: 'Could help. Worth a quick check.' },
  { icon: 'flag', label: 'Ask a teacher', detail: 'Not clear yet. Check before using it.' },
]

function CopyScriptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      className="ghost-button ghost-button--copy"
      type="button"
      onClick={() => {
        const showCopied = () => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        }

        navigator.clipboard
          ?.writeText(text)
          .then(showCopied)
          .catch(() => {
            // Clipboard can be blocked; the words stay visible above to copy by hand.
          })
      }}
    >
      <AppIcon name="quote" className="button-icon button-icon--sm" />
      {copied ? 'Copied!' : 'Copy these words'}
    </button>
  )
}

interface ResultsViewProps {
  analysis: AnalysisExecution
  onAskAboutAccommodation?: (
    item: AnalysisExecution['result']['notObviouslyRelevant'][number],
  ) => void
  onRerun?: () => void
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
      title: 'These likely help with this work',
      description:
        'These supports look like a good match for this school work.',
      items: checkFirst,
      tone: 'accent',
    },
    {
      eyebrow: 'Ask a teacher',
      title: 'These might help — check first',
      description:
        'These could fit, but a quick question to a teacher will make it clear.',
      items: worthConfirming,
      tone: 'soft',
    },
  ]
}

function buildAccommodationScript(name: string) {
  return `My IEP says I get ${name}. Can we check how I should use it for this work before I start?`
}

function buildAlternativeAccommodationScripts(name: string) {
  return [
    `Can I use my ${name} support for this work?`,
    `My IEP gives me ${name}. Does that apply here?`,
  ]
}

function iconForAccommodation(name: string): AppIconName {
  const value = name.toLowerCase()
  if (value.includes('time')) return 'clock'
  if (
    value.includes('read aloud') ||
    value.includes('audio') ||
    value.includes('listen') ||
    value.includes('text-to-speech') ||
    value.includes('text to speech')
  ) {
    return 'headphones'
  }
  if (
    value.includes('organizer') ||
    value.includes('graphic') ||
    value.includes('outline') ||
    value.includes('chart')
  ) {
    return 'notebook'
  }
  if (
    value.includes('dictat') ||
    value.includes('scribe') ||
    value.includes('speech-to-text') ||
    value.includes('voice') ||
    value.includes('speak')
  ) {
    return 'microphone'
  }
  if (value.includes('note')) return 'notebook'
  return 'spark'
}

type RelevantAccommodation =
  AnalysisExecution['result']['relevantAccommodations'][number]

function AccommodationCard({
  item,
  waypointLabel,
}: {
  item: RelevantAccommodation
  waypointLabel: string
}) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()

  return (
    <article
      className={`accommodation-card accommodation-card--${item.confidence}${
        expanded ? ' accommodation-card--open' : ''
      }`}
    >
      <button
        type="button"
        className="accommodation-card__summary-button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="accommodation-card__icon" aria-hidden="true">
          <AppIcon name={iconForAccommodation(item.name)} />
        </span>

        <span className="accommodation-card__summary-text">
          <span className="accommodation-card__waypoint">
            <AppIcon name="star" className="button-icon button-icon--sm" />
            {waypointLabel}
          </span>
          <h3>{item.name}</h3>
          <p className="accommodation-card__summary">{item.plainLanguage}</p>
        </span>

        <span className="accommodation-card__summary-meta">
          <ConfidenceBadge confidence={item.confidence} />
          <AppIcon
            name="chevron"
            className="accommodation-card__chevron"
            aria-hidden="true"
          />
        </span>
      </button>

      <div id={bodyId} className="accommodation-card__body" hidden={!expanded}>
        <div className="accommodation-columns">
          <section className="accommodation-pane accommodation-pane--why">
            <h4>
              <AppIcon name="results" className="button-icon button-icon--sm" />
              <span>Why this may help</span>
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
              <span>What to check</span>
            </h4>
            <p>{CONFIRMATION_COPY[item.confidence]}</p>
          </section>

          <section className="accommodation-pane accommodation-pane--script">
            <h4>
              <AppIcon name="quote" className="button-icon button-icon--sm" />
              <span>What you can say</span>
            </h4>
            <blockquote className="quote-card quote-card--inline">
              <p>{buildAccommodationScript(item.name)}</p>
            </blockquote>
            <CopyScriptButton text={buildAccommodationScript(item.name)} />
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
              Show the IEP wording this comes from
            </span>
          </summary>

          <p className="source-snippet__body">{item.sourceText}</p>
        </details>
      </div>
    </article>
  )
}

export function ResultsView({
  analysis,
  onAskAboutAccommodation,
  onRerun,
}: ResultsViewProps) {
  const supportGroups = buildSupportGroups(analysis)
  const isCachedResult = analysis.meta.mode === 'demo'
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
        eyebrow="Your results"
        title="Here's what may help"
        description="We matched your IEP supports to your school work. Start at the top."
        tone="accent"
        icon={<AppIcon name="compass" />}
      >
        <div className="results-overview">
          <p className="results-priority-note">
            {studentGuidance.startHere}
          </p>

          <div className="results-meta results-meta--summary" aria-label="Quick summary">
            <span className="meta-badge">
              {formatSupportCount(likelyCount, 'strong fit', 'strong fits')}
            </span>
            <span className="meta-badge">
              {formatSupportCount(confirmCount, 'to ask about', 'to ask about')}
            </span>
          </div>

          <dl className="confidence-legend" aria-label="What the labels mean">
            {CONFIDENCE_LEGEND.map((entry) => (
              <div key={entry.label} className="confidence-legend__item">
                <dt>
                  <AppIcon name={entry.icon} className="button-icon button-icon--sm" />
                  {entry.label}
                </dt>
                <dd>{entry.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </SectionCard>

      <div
        className={`results-source-note${
          isCachedResult ? ' results-source-note--cached' : ''
        }`}
      >
        <p className="results-source-note__text">
          <AppIcon
            name={isCachedResult ? 'flag' : 'check'}
            className="button-icon button-icon--sm"
          />
          {isCachedResult
            ? 'This mapping used a saved demo response, not a fresh model run.'
            : 'This mapping was generated fresh, not from a saved demo response.'}
        </p>
        {isCachedResult && onRerun ? (
          <button className="ghost-button" type="button" onClick={onRerun}>
            <AppIcon name="results" className="button-icon button-icon--sm" />
            Re-run fresh mapping
          </button>
        ) : null}
      </div>

      {analysis.result.relevantAccommodations.length === 0 ? (
        <SectionCard
          eyebrow="Nothing clear yet"
          title="We could not find a clear match yet"
          description="This usually just means we need a little more about the school work. You did nothing wrong."
          icon={<AppIcon name="waypoint" />}
          tone="soft"
        >
          <div className="results-empty-state">
            <span className="results-empty-state__icon" aria-hidden="true">
              <AppIcon name="waypoint" />
            </span>
            <div>
              <h3>Add a little more, then try again</h3>
              <p>
                Go back and add more about the directions, the timing, or what
                kind of work it is. Then see what helps again.
              </p>
            </div>
          </div>

          {analysis.result.notObviouslyRelevant.length > 0 ? (
            <div className="skipped-accommodation-list">
              <div className="results-detail-block">
                <h3>Want to ask about one anyway?</h3>
                <p>
                  These supports are in your IEP, but we did not have enough
                  about the school work to connect them.
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
                <AccommodationCard
                  key={`${item.name}-${item.sourceText}`}
                  item={item}
                  waypointLabel={
                    group.eyebrow === 'Check first'
                      ? `Check ${index + 1}`
                      : `Ask about ${index + 1}`
                  }
                />
              ))}
            </div>
          </SectionCard>
        ))}

      <div className="results-sidecar-grid">
        <SectionCard
          eyebrow="For a grown-up"
          title="Notes for a parent or guardian"
          description="These notes help an adult support the student without speaking for them."
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
          eyebrow="For a teacher"
          title="Notes for a teacher"
          description="These notes are about setting up the support, not about doing the work for the student."
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
        eyebrow="More detail"
        title="Why we said this"
        description="Open this if you want to see our notes and the supports we did not connect."
        tone="soft"
        icon={<AppIcon name="results" />}
      >
        <details className="results-details-panel">
          <summary className="results-details-panel__summary">
            <span className="summary-label">
              <AppIcon name="compass" className="button-icon button-icon--sm" />
              Show more detail
            </span>
          </summary>

          <div className="results-details-panel__body">
            {analysis.meta.notes.length > 0 ? (
              <div className="results-detail-block">
                <h3>Our notes</h3>
                <ul className="support-list">
                  {analysis.meta.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="results-detail-block">
              <h3>Supports we did not connect to this work</h3>
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
                  We connected every support in your IEP, or noted one to check.
                </p>
              )}
            </div>

            <div className="results-detail-block">
              <h3>Rules we followed</h3>
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
