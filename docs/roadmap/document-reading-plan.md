# Gemma 4 OCR Document Reading Plan

## Summary

- Keep direct browser extraction for `.txt`, `.md`, and other `text/*` files.
- Use Gemma 4 OCR for images and PDFs.
- Route OCR through the existing configured Gemma endpoint path instead of the current in-browser Gemma testing surface.
- Keep OCR explicit, visible, reviewable, and opt-in before any upload text reaches the analysis flow.
- Keep a separate Gemma 4 31B image-eval loop for measuring document interpretation quality without conflating it with the normal E2B user-facing path.

## Current State Audit

- `src/App.tsx` owns the source flow, attachment lifecycle, and the handoff into analysis.
- `src/features/upload/fileUtils.ts` normalizes uploads, generates previews, and now supports immediate attachment shells plus local text-file hydration.
- `src/features/source/sourceText.ts` is the trust-boundary seam. It now uses only `source.text` plus `attachment.reviewedText` when building analysis input.
- `src/features/source/SourceEditor.tsx` is the main review surface for upload text. It now shows OCR status, review textareas, and explicit include/reference actions per file.
- `src/features/source/SourceReviewPanel.tsx` is the results-side source trail and now separates entered text, reviewed upload text, and reference-only files.
- `src/features/upload/gemmaOcr.ts` owns Gemma OCR requests against the configured endpoint and handles image/PDF OCR orchestration.
- `src/features/upload/pdfPageImages.ts` renders the first 3 PDF pages to images before OCR.
- `src/lib/schema/ocrSchema.ts` validates OCR JSON before it touches app state.

## MVP Scope

### Supported

- `.txt`, `.md`, and other `text/*` files through local browser reading.
- Images through explicit Gemma 4 OCR.
- PDFs through browser-side page rendering plus Gemma 4 OCR on the first 3 rendered pages.

### Explicitly Out Of Scope

- Background OCR without a user action.
- Automatic inclusion of OCR text in analysis.
- OCR beyond the first 3 PDF pages.
- Browser-only multimodal OCR through the current in-browser Gemma panel.

## UX Flow

1. Upload a file and show it immediately in the attachment list.
2. For text files, read the text locally and make it source-ready right away.
3. For images and PDFs, show `Read text with Gemma 4` instead of auto-running OCR.
4. If the OCR endpoint is remote, show a short disclosure before OCR is used.
5. After OCR finishes, show a review textarea with the OCR draft.
6. Let the user either:
   - use the reviewed text in the source trail, or
   - keep the file as reference only.
7. Only reviewed text becomes part of analysis input.

## Technical Design

- `src/features/upload/fileUtils.ts`
  - Create immediate attachment shells.
  - Hydrate text files locally.
  - Rebuild attachment notes from status and OCR metadata.
- `src/features/upload/gemmaOcr.ts`
  - Read OCR config from the existing Gemma env vars.
  - Send image content to the configured `/chat/completions` endpoint.
  - Retry on the fallback model when configured.
- `src/features/upload/pdfPageImages.ts`
  - Render PDF pages with `pdfjs-dist`.
  - Limit OCR to the first 3 pages.
  - Yield between pages to reduce UI blocking.
- `src/lib/schema/ocrSchema.ts`
  - Validate OCR JSON:
    - `transcribedText`
    - `containsUnclearText`
    - `notes`

## Data Model

`UploadedAttachment` now supports:

- `reviewedText`
- `ocrMethod`
- `ocrError`
- `ocrNotes`
- `ocrContainsUnclearText`
- `pageCount`
- `processedPageCount`

Attachment statuses now include:

- `text_ready`
- `ocr_ready`
- `ocr_running`
- `review_ready`
- `included`
- `reference_only`
- `failed`

## Integration Points

- `src/App.tsx`
  - immediate attachment append
  - local text hydration
  - manual OCR launch
  - reviewed-text acceptance
  - reference-only fallback
  - correction-flow parity
- `src/features/source/sourceText.ts`
  - reviewed upload text only
- `src/features/source/SourceEditor.tsx`
  - OCR controls and draft review UI
- `src/features/source/SourceReviewPanel.tsx`
  - used vs reference-only source trail
- `src/lib/analysis/gemmaAdapter.ts`
  - clearer upload note summaries
- `src/lib/analysis/mockAnalysis.ts`
  - trust-boundary language aligned to reviewed upload text

## Risks And Edge Cases

- OCR can hallucinate or smooth over unclear text, so review remains mandatory.
- Small print or skewed photos may still produce noisy OCR.
- Multi-page PDFs are capped to control cost and latency.
- Remote OCR endpoints are not local-only, so disclosure matters.
- Duplicate source wording can appear if users both paste text and accept OCR; the source aggregation layer still deduplicates repeated text blocks.

## Eval Loop

- Use `scripts/evals/image/*` for repeatable image-interpretation measurement.
- Default eval target model: `gemma4:31b`.
- Keep eval prompts, schemas, fixtures, and scoring separate from the browser E2B experience.
- Grow the fixture set across:
  - accommodation uploads
  - assignment uploads
  - blurry/cropped edge cases
  - mixed-content pages where only part of the page should be extracted

## Phase Notes

### Phase 1

- Explicit OCR review state
- Manual Gemma OCR for images
- First-3-pages PDF OCR
- Reviewed-text-only analysis boundary

### Phase 2

- Better PDF progress and page-level controls
- Cleaner OCR ordering and failure messaging

### Phase 3

- Separate OCR model selection only if quality testing justifies it
- Optional photo cleanup or cropping helpers
- Revisit browser multimodal OCR only if the runtime actually supports it end to end

## Recommended Next Build Step

- Validate Gemma OCR quality with real worksheet photos, screenshots, and IEP excerpts across:
  - local Ollama
  - same-origin proxy setups
  - at least one remote configured endpoint
- Then tighten any copy, truncation messaging, or OCR prompt wording that still feels too technical or too hidden for parents and middle-school students.
