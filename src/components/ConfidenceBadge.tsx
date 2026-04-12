import type { AccommodationConfidence } from '../lib/schema/analysisSchema'

const CONFIDENCE_LABELS: Record<AccommodationConfidence, string> = {
  likely_relevant: 'Likely relevant',
  possibly_relevant: 'Possibly relevant',
  unclear_confirm: 'Unclear, confirm with staff',
}

export function ConfidenceBadge({
  confidence,
}: {
  confidence: AccommodationConfidence
}) {
  return (
    <span className={`confidence-badge confidence-badge--${confidence}`}>
      {CONFIDENCE_LABELS[confidence]}
    </span>
  )
}
