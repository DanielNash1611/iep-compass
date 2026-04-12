import { SectionCard } from '../../components/SectionCard'
import type { ExampleScenario } from '../../data/examples'

interface ExampleScenarioPickerProps {
  activeExampleId: string | null
  examples: ExampleScenario[]
  onSelect: (exampleId: string) => void
  onStartBlank: () => void
}

export function ExampleScenarioPicker({
  activeExampleId,
  examples,
  onSelect,
  onStartBlank,
}: ExampleScenarioPickerProps) {
  return (
    <SectionCard
      eyebrow="Seeded scenarios"
      title="Start from a realistic classroom example"
      description="These sample cases mirror the PRD scenarios so the MVP has a stable demo flow on first launch."
    >
      <div className="example-picker__header">
        <div>
          <p>
            Pick one to prefill the workspace, or start with a blank draft for
            live testing.
          </p>
        </div>

        <div className="example-picker__actions">
          <button className="ghost-button" type="button" onClick={onStartBlank}>
            Start blank
          </button>
        </div>
      </div>

      <div className="example-grid">
        {examples.map((example) => {
          const isActive = example.id === activeExampleId

          return (
            <button
              key={example.id}
              className={`example-card${isActive ? ' example-card--active' : ''}`}
              type="button"
              onClick={() => onSelect(example.id)}
            >
              <div>
                <h3 className="example-card__title">{example.title}</h3>
                <p className="example-card__summary">{example.summary}</p>
              </div>

              <div className="example-card__footer">
                <span className="mini-chip">{example.role}</span>
                {example.contextTags.slice(0, 2).map((tag) => (
                  <span key={tag} className="mini-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </SectionCard>
  )
}
