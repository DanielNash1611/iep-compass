import { SectionCard } from '../../components/SectionCard'

interface IEPExcerptInputProps {
  onChange: (nextValue: string) => void
  value: string
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

export function IEPExcerptInput({
  onChange,
  value,
}: IEPExcerptInputProps) {
  return (
    <SectionCard
      eyebrow="Step 1"
      title="Paste the IEP accommodations excerpt"
      description="Keep this focused on the accommodations section. The app will only cite supports that appear here."
    >
      <div className="field-stack">
        <label className="textarea-label">
          <span className="field-label__title">IEP excerpt</span>
          <textarea
            className="textarea-input"
            name="iepExcerpt"
            placeholder="Example:
- Extended time for quizzes and tests
- Reduced-distraction setting for assessments
- Directions clarified and chunked"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>

        <div className="field-footer">
          <span>{countLines(value)} accommodation lines or notes</span>
          <span>{value.trim().length} characters</span>
        </div>
      </div>
    </SectionCard>
  )
}
