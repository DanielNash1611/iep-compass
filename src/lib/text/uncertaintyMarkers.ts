const UNCERTAINTY_MARKERS = [
  '[unclear]',
  '[blank]',
  '[redacted]',
  'unclear',
  'hard to read',
  'not clearly visible',
  'not visible',
  'partially visible',
  'partially cut off',
  'partly cut off',
  'cropped',
  'cut off',
  'blur',
  'blurry',
  'illegible',
] as const

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function hasUncertaintyMarkers(value: string) {
  const normalized = normalizeText(value)
  return UNCERTAINTY_MARKERS.some((marker) => normalized.includes(normalizeText(marker)))
}

export function listUncertaintyMarkers() {
  return [...UNCERTAINTY_MARKERS]
}
