# IEP Compass

IEP Compass is a phone-first web app that helps students, families, and teachers understand when an existing IEP accommodation may be relevant to a specific classroom task and how to advocate for it clearly.

The app is intentionally narrow:

- It only references accommodations explicitly found in the uploaded IEP excerpt.
- It does not create new accommodations.
- It does not answer assignment, worksheet, quiz, or test content.
- It does not present itself as legal advice or a replacement for the IEP team.

## Setup

### Requirements

- Node.js 22+
- npm 10+

### Install

```bash
npm install
```

### Optional Gemma configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then set the values for your inference endpoint.

### Run locally

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Gemma 4 integration

The analysis layer is designed around Gemma 4 with an adapter that can be swapped later.

- Primary model: `Gemma 4 E4B`
- Fallback model: `Gemma 4 E2B`
- The app does not start with `Gemma 4 26B A4B` or `31B`
- Prompts are structured for accommodation relevance mapping, not general chat
- The adapter keeps room for future multimodal support

### Environment variables

The app reads these Vite variables:

- `VITE_GEMMA_BASE_URL`
- `VITE_GEMMA_API_KEY`
- `VITE_GEMMA_PRIMARY_MODEL`
- `VITE_GEMMA_FALLBACK_MODEL`
- `VITE_GEMMA_MULTIMODAL`

Default model IDs in the adapter are:

- `gemma-4-e4b`
- `gemma-4-e2b`

If your inference runtime uses different exact IDs, update the env values while keeping the same primary and fallback model plan.

### Runtime behavior

- If `VITE_GEMMA_BASE_URL` is set, the app attempts a remote `Gemma 4 E4B` call first.
- If that fails, it retries with `Gemma 4 E2B`.
- If both fail, or if no endpoint is configured, the app falls back to deterministic demo analysis so the MVP remains usable.

## Architecture

The app is organized to keep UI, schema, and analysis concerns separate:

- `src/App.tsx`: app shell, state wiring, and milestone demo flow
- `src/components/*`: shared UI primitives
- `src/features/input/*`: example picker and core text inputs
- `src/features/upload/*`: upload actions, preview state, and file utilities
- `src/features/results/*`: role-aware result rendering
- `src/lib/schema/*`: Zod output schema
- `src/lib/analysis/*`: Gemma prompts, adapter, and deterministic fallback
- `src/types/*`: shared TypeScript types
- `src/data/examples.ts`: seeded PRD scenarios

## Privacy posture

This MVP treats IEP and task materials as sensitive student information.

- Storage is minimized by default.
- There are no accounts or school-system integrations in the MVP.
- Uploads are kept local in the browser during the current session.
- The UI repeatedly states what the app does and does not do.
- The app is designed to support parent/student-controlled usage first.

## Mobile and browser testing notes

### Phone testing

For same-network device testing:

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

Then open the Vite dev URL from your phone on the same local network.

What to test on phone:

- large tap targets for role selection and context chips
- `Take photo` flow
- image preview before analysis
- stacked layout in the input and results panels
- results readability and scroll behavior

### Chromebook testing

Use the `Upload file` button to test:

- screenshots from local storage
- PDF uploads
- text file uploads
- side-by-side review on the wider layout

Also test camera/photo capture if the device browser supports it, but expect that support to vary by browser and permissions.

## Known limitations and tradeoffs

These are intentional MVP tradeoffs and are documented here so scope does not drift silently.

1. Uploaded images and PDFs are previewed, but not automatically OCR-parsed in the default MVP path.
Because reliable OCR and PDF extraction would add more moving parts than the current demo needs, the app asks the user to review or paste the important task text before analysis. The adapter is structured so multimodal or extraction upgrades can be added later.

2. Remote model calls are configured directly from the web app for local MVP flexibility.
That is acceptable for a local demo, but production deployment should move the model call behind a server-side proxy so keys and sensitive data are not exposed in the browser.

3. Direct private GitHub repo creation is not supported by the GitHub integration tools available in this environment.
The project includes `GITHUB_NEXT_STEPS.md` with the exact `gh repo create iep-compass --private --source=. --remote=origin --push` command and fallback push flow.

4. Demo mode is deterministic by design.
When no remote Gemma endpoint is configured, the app still runs with the same structured schema and safety boundaries, but the analysis uses rule-based matching rather than live model inference.

## What remains after MVP

- OCR for image and PDF uploads
- richer multimodal Gemma request handling
- backend proxy for production-safe model calls
- saved accommodation profiles with explicit consent
- deeper document review and cropping flows
- broader browser and device QA across real phones and Chromebooks

## GitHub next steps

If you want to create the private repository and push this code, follow `GITHUB_NEXT_STEPS.md`.
