# Gemma image eval report

- Generated at: 2026-05-18T16:05:13.539Z
- Model: gemma4:e2b
- Judge mode: off
- Judge model: gemma4:31b

## accommodation_upload

- Total cases: 6
- Executed cases: 6
- Pass rate: 0.5
- Hallucination rate: 0.167
- Uncertainty-handling score: 0.833
- Condition-preservation score: 1
- Incomplete-image handling score: n/a
- Major failure categories: ocr_failure (2), missed_accommodation (1), hallucinated_accommodation (1), overconfident_on_unclear_text (1)

### Judge dimensions
- judge disabled or unavailable

### Failed cases
- jordan_demo_iep_snapshot: missed_accommodation, ocr_failure
- mixed_sections_page: hallucinated_accommodation
- real_accommodation_page_phone_photo: ocr_failure, overconfident_on_unclear_text