# Gemma 4 31B Image Evals

This folder holds the repeatable image-interpretation eval loop for IEP Compass.

Important separation:

- The normal user-facing product flow can keep using the E2B path.
- These evals intentionally target **Gemma 4 31B** by default so image understanding can be measured directly against that model.
- Treat the 31B runs as the image-interpretation source of truth.
- Treat the lighter app-model run only as a production comparison snapshot against that 31B target.

Important architecture note:

- The eval harness uses the same accommodation-reading shape as the app:
  1. Gemma reads the accommodation image and produces plain review text for direct pasting into the accommodations text box.
- Assignment and rubric evals still use the two-step path:
  1. Gemma reads the image and produces a looser freeform extraction.
  2. Gemma converts that extracted text into the required structured JSON schema.
  3. The structured result should classify the visible document, summarize
     access-relevant details, and ask short follow-up questions instead of
     trying to OCR every line.
- When the base URL points at local Ollama, the eval harness uses the official `ollama` JS SDK for the local image stage instead of the OpenAI-compatible transport.
- Exception for the lighter app comparison:
  - the `gemma4:e2b` accommodation comparison now follows the live app request shape more closely
  - it uses the app-style plain-text system prompt and `/v1/chat/completions` request path
  - it runs each case in a fresh Node process so sequential local multimodal drift is easier to separate from true model-quality misses
  - it retries only runtime or transport failures, not ordinary low-quality outputs

## What is here

- `run.ts`
  - CLI runner for image evals
- `adapter.ts`
  - accommodation text extraction plus assignment two-step image eval adapter
- `openaiCompatible.ts`
  - OpenAI-compatible helpers for remote paths plus official Ollama SDK helpers for local paths
- `prompts.ts`
  - editable accommodation and assignment image prompts
- `scoring.ts`
  - deterministic checks, field checks, failure tags, and pass logic
- `judge.ts`
  - optional rubric/judge scoring abstraction
- `cases/`
  - JSON case definitions split by suite
- `fixtures/`
  - image assets used by the cases

## Suites

- `accommodation_upload`
  - plain-text accommodation extraction for IEP/accommodation documents
- `assignment_upload`
  - image interpretation for assignments, rubrics, worksheets, quizzes, and tests

## Running

Run all image evals:

```bash
npm run evals:gemma:image
```

Run one suite:

```bash
npm run evals:gemma:image -- --suite accommodation_upload
npm run evals:gemma:image -- --suite assignment_upload
```

Run the lighter app-model production comparison snapshot:

```bash
npm run evals:gemma:image:compare:app
```

That comparison command now:

- runs suite `accommodation_upload`
- uses model `gemma4:e2b`
- executes each case in a fresh process
- retries one time only for runtime or transport failures
- keeps the default 31B eval path unchanged

Run one case:

```bash
npm run evals:gemma:image -- --case essay_rubric_spelling
```

Enable model-judge scoring:

```bash
npm run evals:gemma:image -- --judge model
```

Write reports:

```bash
npm run evals:gemma:image -- --json tmp/image-evals.json --md tmp/image-evals.md
```

## Environment

Primary image-eval env vars:

- `GEMMA_IMAGE_EVAL_BASE_URL`
- `GEMMA_IMAGE_EVAL_API_KEY`
- `GEMMA_IMAGE_EVAL_MODEL`
- `GEMMA_IMAGE_EVAL_JUDGE_MODE`
- `GEMMA_IMAGE_EVAL_JUDGE_MODEL`
- `GEMMA_IMAGE_EVAL_INACTIVITY_TIMEOUT_MS`
- `GEMMA_IMAGE_EVAL_TIMEOUT_MS`

Defaults:

- `GEMMA_IMAGE_EVAL_MODEL=gemma4:31b`
- `GEMMA_IMAGE_EVAL_JUDGE_MODE=off`
- `GEMMA_IMAGE_EVAL_INACTIVITY_TIMEOUT_MS=180000`
- `GEMMA_IMAGE_EVAL_TIMEOUT_MS=600000`

App-model comparison note:

- `npm run evals:gemma:image:compare:app` intentionally overrides the model to `gemma4:e2b` so the lighter user-facing app path can be measured against the default 31B eval target.
- This is not a second co-equal eval target. It is a production comparison run.
- The comparison runner records per-pass attempt details and per-case fresh-process retry history in the JSON report diagnostics so runtime failures can be separated from content failures.

Base URL falls back to `GEMMA_EVAL_BASE_URL` and then `VITE_GEMMA_BASE_URL` so the harness can reuse an existing endpoint without reusing the production model selection.

When the runner is executed in Node and the base URL is a browser-style relative path such as `/api/ollama` or `/v1`, it resolves that path through `GEMMA_PROXY_TARGET` and defaults to `http://127.0.0.1:11434`.

## Adding a new case

1. Add an image to `scripts/evals/image/fixtures/<suite>/`.
2. Add a JSON case file to `scripts/evals/image/cases/<suite>/`.
3. Keep `image_path` repo-relative, for example:
   - `scripts/evals/image/fixtures/assignment_upload/my_case.png`
4. Fill in the expected fields only for signals you want to grade deterministically.
5. Run the single case first with `--case <id>`.

## Reading results

- `pass_rate`
  - share of executed cases that passed deterministic/field checks and, when enabled, judge scoring
- `hallucination_rate`
  - share of executed cases tagged with hallucination failures
- `uncertainty_handling_score`
  - how well the model lowers confidence or asks for more context on blurry/cropped cases
- `condition_preservation_score`
  - accommodation-suite metric for preserving exception language
- `incomplete_image_handling_score`
  - assignment-suite metric for flagging cropped or partial images
- `failure_tags`
  - actionable labels for the main failure mode on each case
