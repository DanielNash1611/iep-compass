# IEP Compass

IEP Compass helps students, families, and teachers map approved IEP accommodations to real classroom assignments without inventing new supports or answering the schoolwork. It is a phone-first React app built for the Gemma 4 Good Hackathon under a Future of Education + Safety & Trust story.

## Hackathon Submission Snapshot

- **Problem:** students often have approved accommodations but still struggle to know when and how to use them on a specific worksheet, quiz, or assignment.
- **Solution:** IEP Compass reviews approved accommodation wording, reviews assignment details, and produces a grounded accommodation map with student-friendly advocacy language and clear uncertainty.
- **Gemma 4 use:** Browser Gemma 4 E2B handles reviewed-text accommodation mapping on supported devices through the official MediaPipe / Google AI Edge web stack. A labeled local Gemma endpoint can read the synthetic presentation images during development, while the app stays candid that Gemma 4 E2B browser image input is not currently documented for this web task.
- **Trust model:** only reviewed source text can enter the analysis trail, model-selected accommodation IDs are constrained in the seeded walkthrough, and the app does not answer academic tasks or make legal determinations.
- **Live demo:** [iepcompass.danielnash.co](https://iepcompass.danielnash.co)
- **Writeup draft:** [`docs/submission/kaggle-writeup-draft.md`](docs/submission/kaggle-writeup-draft.md)

This repo keeps the main IEP Compass experience intact while adding an embedded browser-first testing panel for **Gemma 4 E2B** on supported devices, using the official **MediaPipe / Google AI Edge** web inference stack.

## Current Feasibility

**Yes, Gemma 4 E2B browser text inference is currently feasible. Live image interpretation is not enabled for the current Gemma 4 E2B browser path.**

What is verified:

- Google’s MediaPipe Web docs point to newly released Gemma 4 E2B and E4B browser models for LLM Inference Web.
- The official `@mediapipe/tasks-genai` package README links directly to a Gemma 4 E2B browser asset.
- The official LiteRT community model page lists the browser-ready file as:
  - `gemma-4-E2B-it-web.task`
- The installed `@mediapipe/tasks-genai` API exposes image prompt parts and `maxNumImages`, but the current MediaPipe web guide and package README document image/audio prompting for Gemma-3n models. IEP Compass therefore treats the Gemma 4 E2B browser path as text reasoning only until Google documents image input for that specific web task.

Important limitation:

- This repo does **not** bundle the multi-GB model asset.
- Until you place the official file at the configured path, the UI will intentionally show:
  - `unsupported`
  - reason: `model asset unavailable`

That is deliberate. The app is wired for the official asset, but it will not pretend the model exists locally when it does not.

## Product Shape

- The main `IEP Compass` flow remains the primary UX.
- The Gemma 4 browser test surface now lives as an optional card inside the assignment step.
- The browser path is the primary competition path.
- The stable phone demo uses synthetic sample images from `public/demo/` so Android Chrome does not need to keep a live camera upload and the browser model loaded at the same time.
- Browser Gemma maps reviewed source-trail text to accommodation guidance after the document images have been interpreted and reviewed.
- Browser Gemma image interpretation is shown as unavailable for the current web stack, even when browser text reasoning can work.
- A local endpoint can be configured as a development image-reading path. In the Jordan walkthrough, the seeded sample images can be read through this labeled local Gemma/Ollama endpoint so viewers can see the small model interpret the documents. It is the only live image/PDF interpretation path in the web app right now and may send image data to the configured endpoint.
- The reviewed-text mapping step remains browser Gemma first for the Jordan walkthrough, so the local image reader does not turn the final text reasoning flow back into an endpoint-only flow.
- The intended final product direction is a native Android app using Google AI Edge for private on-device capture and image inference, unless Google documents a Gemma 4 E2B browser image path.

## Image Eval Loop

The repo also includes a dedicated image-interpretation eval harness for document-reading work.

Important separation:

- the normal user-facing experience may use the E2B path
- image evals intentionally target **Gemma 4 31B** by default so vision quality can be measured directly against that model
- the 31B image eval is the primary quality target
- the lighter app model should only be run as a production comparison against that target

Useful commands:

```bash
npm run evals:gemma:image
npm run evals:gemma:image:accommodation
npm run evals:gemma:image:assignment
npm run evals:gemma:image:compare:app
npm run evals:gemma:image -- --case essay_rubric_spelling
npm run evals:gemma:image -- --json tmp/image-evals.json --md tmp/image-evals.md
```

See `scripts/evals/image/README.md` for case format, fixtures, scoring, and reporting details.

Comparison-path note:

- `npm run evals:gemma:image:compare:app` now runs the lighter `gemma4:e2b` accommodation suite in fresh per-case processes with one retry only for runtime or transport failures.
- That comparison path is meant to mirror the current app request shape more closely and reduce sequential local multimodal drift.
- The default 31B image eval target and local 31B transport behavior remain unchanged.

## Exact Model Asset Requirement

Use the official Gemma 4 E2B browser asset:

- File format: `.task`
- Expected default filename: `gemma-4-E2B-it-web.task`
- Default app path: `/models/gemma-4-E2B-it-web.task`

Official sources:

- MediaPipe LLM Inference Web guide: [developers.google.com/mediapipe/solutions/genai/llm_inference/web_js](https://developers.google.com/mediapipe/solutions/genai/llm_inference/web_js)
- Google AI Edge overview: [ai.google.dev/edge/mediapipe/solutions/genai/llm_inference](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference)
- Official LiteRT community model page: [huggingface.co/litert-community/gemma-4-E2B-it-litert-lm](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm)
- Direct model file page: [huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/blob/main/gemma-4-E2B-it-web.task](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/blob/main/gemma-4-E2B-it-web.task)
- Gemma 4 prompt formatting: [ai.google.dev/gemma/docs/core/prompt-formatting-gemma4](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Put the official model asset in the public models directory

Create this file:

```text
public/models/gemma-4-E2B-it-web.task
```

The repo already includes the `public/models/` folder placeholder.

### 3. Optional environment overrides

Copy the example file if you want to override the defaults:

```bash
cp .env.example .env.local
```

Available variables:

- `VITE_GEMMA_APP_MODEL`
- `VITE_GEMMA4_WEB_MODEL_PATH`
- `VITE_MEDIAPIPE_WASM_ROOT`
- `VITE_GEMMA_BASE_URL`
- `VITE_GEMMA_API_KEY`
- `VITE_GEMMA_PRIMARY_MODEL`
- `VITE_GEMMA_FALLBACK_MODEL`
- `VITE_GEMMA_MULTIMODAL`
- `GEMMA_PROXY_TARGET`
- `GEMMA_IMAGE_EVAL_BASE_URL`
- `GEMMA_IMAGE_EVAL_API_KEY`
- `GEMMA_IMAGE_EVAL_MODEL`
- `GEMMA_IMAGE_EVAL_JUDGE_MODE`
- `GEMMA_IMAGE_EVAL_JUDGE_MODEL`
- `GEMMA_IMAGE_EVAL_INACTIVITY_TIMEOUT_MS`
- `GEMMA_IMAGE_EVAL_TIMEOUT_MS`

Default values:

- `VITE_GEMMA4_WEB_MODEL_PATH=/models/gemma-4-E2B-it-web.task` in local development
- production default when no override is set: `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task`
- `VITE_MEDIAPIPE_WASM_ROOT=https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.27/wasm`
- `VITE_GEMMA_BASE_URL=/api/ollama`
- `VITE_GEMMA_APP_MODEL=gemma4:e2b`
- `VITE_GEMMA_PRIMARY_MODEL=gemma4:e2b`
- `GEMMA_PROXY_TARGET=http://127.0.0.1:11434`
- `GEMMA_IMAGE_EVAL_MODEL=gemma4:31b`
- `GEMMA_IMAGE_EVAL_JUDGE_MODE=off`
- `GEMMA_IMAGE_EVAL_INACTIVITY_TIMEOUT_MS=180000`
- `GEMMA_IMAGE_EVAL_TIMEOUT_MS=600000`

Local backup notes:

- `VITE_GEMMA_BASE_URL` is optional and exists only for development endpoint testing.
- Production demo builds do not rely on the local `/api/ollama` proxy, but a user can enter an OpenAI-compatible Ollama endpoint in the browser when they have Ollama running on their own device.
- The browser-saved endpoint is stored in localStorage under `iep-compass:ollama-base-url` and takes precedence over `VITE_GEMMA_BASE_URL` until it is cleared.
- Use `http://127.0.0.1:11434/v1` for the default local Ollama OpenAI-compatible endpoint. Entering `http://127.0.0.1:11434` is normalized to `/v1`.
- `VITE_GEMMA_APP_MODEL` is the explicit user-facing app model knob and should stay on the lighter Gemma model unless you are intentionally testing something else.
- `VITE_GEMMA_PRIMARY_MODEL` remains as a legacy fallback for older local setups, but the app prefers `VITE_GEMMA_APP_MODEL` when it is present.
- With the default Vite proxy, `/api/ollama` forwards to `http://127.0.0.1:11434/v1`.
- This local endpoint path sends selected images or PDFs to the configured endpoint for reviewable draft creation; it does not add browser-private Gemma 4 E2B image interpretation.

## Stable Phone Demo

The seeded demo case, `Jordan M. writing assignment`, uses two synthetic sample images:

- `public/demo/jordan-accommodation-snapshot.jpg`
- `public/demo/jordan-character-change-paragraph.jpg`

Those images load as pre-uploaded materials, but they are not automatically trusted and do not include hidden source-trail text. In the walkthrough, choose the labeled local Gemma action to create a new review draft from each sample image when the local endpoint is available. The assignment image should be interpreted by the model during the walkthrough.

In the web walkthrough, the image-reading step is handled by the configured local endpoint when available. Browser Gemma is used for the later mapping step: choosing from allowed accommodation IDs based on reviewed source text. The app rejects model-suggested IDs that are not in the seeded allowed list.

After the first accommodation-image interpretation attempt, the Jordan IEP card can show an `Apply demo correction` helper. That helper is only for the synthetic accommodation snapshot: it inserts the confirmed accommodation wording, keeps the original model draft visible for comparison, and still requires review before anything enters the source trail.

The upload UI distinguishes three states:

- browser Gemma text reasoning: available after the model gate passes
- browser Gemma image interpretation: unavailable for the current Gemma 4 E2B web path
- endpoint-based document reading: optional image-reading path, configured by a browser-saved Ollama endpoint or by `VITE_GEMMA_BASE_URL`

### 4. Run locally

```bash
npm run dev
```

### 5. Build

```bash
npm run build
```

### 6. Lint

```bash
npm run lint
```

## Browser Support Notes

This build is intentionally conservative.

- Primary target: Chrome on Android
- Secondary development target: Chromium desktop
- WebGPU is treated as required
- Missing `navigator.deviceMemory` is treated as unknown, not as proof the device is strong enough
- If the browser looks weak or unsupported, the app refuses to load the model

Important note for phone testing:

- WebGPU usually requires a secure context.
- `localhost` is fine on desktop development.
- A plain LAN HTTP URL from another device may not expose WebGPU.
- For realistic mobile testing, prefer HTTPS or a deployed preview URL.
- If browser mode is blocked, the embedded testing panel can still use a configured local endpoint as a backup sanity check.

## Memory Caveats

This app is designed around memory pressure, not around maximum model capability.

What it does on purpose:

- model download/saving is explicit and user-triggered
- the first browser-model download is saved in Cache Storage when available
- later visits can open from the saved browser file until site storage is cleared or evicted
- production launch does not keep Gemma instantiated in WebGPU memory before the photo upload flow
- light mode is enabled by default
- prompts are capped aggressively
- context history is not retained
- response length is kept short with low token budgets
- reset fully unloads the session when possible
- devices reporting less than 8 GiB through `navigator.deviceMemory` are blocked before load

Current in-app budgets:

- Light mode:
  - about 192 input tokens
  - 256 total tokens
- Standard mode:
  - about 256 input tokens
  - 384 total tokens

These are engineering choices for device safety, not official Gemma limits.

## Keeping The Model Out Of Git

The repo intentionally ignores:

- `public/models/*.task`
- `public/models/*.litertlm`

Recommended approach:

- keep the official model file in ignored local storage during development
- or host it separately and point `VITE_GEMMA4_WEB_MODEL_PATH` at that path

Tradeoffs if you commit the model into the repo anyway:

- multi-GB git history growth
- much slower clone, pull, and branch operations
- poor CI and preview performance
- awkward merge and release workflows
- likely need for Git LFS, which adds install, quota, and hosting complexity

Git LFS is safer than raw git for a large model asset, but it still increases friction for every contributor and deployment system.

## How To Swap The Model Path

If you host the official file somewhere else, update:

- `.env.local`
  - `VITE_GEMMA4_WEB_MODEL_PATH=https://your-host/path/gemma-4-E2B-it-web.task`

or change the default in:

- `src/lib/on-device/modelConfig.ts`

Same-origin hosting is recommended for production-minded deployments.

Production launch note:

- Production builds now require the configured browser model to be reachable before the main app opens.
- The launch gate downloads the model only after a user action and only when the network check allows it; if the model is already cached, the gate opens the app instead of requiring another download or preloading Gemma into memory.
- A cached model file can satisfy the asset check if the remote URL probe later fails, but browser support, WebGPU, and memory checks still apply.
- Unsupported browsers and devices, including iPhone and iPad browsers for this launch, receive an unsupported-device message instead of a non-AI fallback.

## Architecture

The code is intentionally split into inspectable layers:

- `src/App.tsx`
  - the main IEP Compass product flow
- `src/lib/on-device/capabilityCheck.ts`
  - browser support checks, WebGPU checks, memory hints, and model asset gating
- `src/lib/on-device/modelBootstrap.ts`
  - MediaPipe / Google AI Edge model bootstrap
- `src/lib/on-device/inferenceSession.ts`
  - memory-conscious prompt handling and generation wrapper
- `src/lib/on-device/localBackupSession.ts`
  - optional local endpoint path for development testing
- `src/features/on-device/BrowserGemmaApp.tsx`
  - embedded testing panel UI state inside the existing app

## Manual Conversion

No manual conversion path is documented here for Gemma 4 E2B because an official browser-ready asset already exists.

If you later want a different Gemma 4 variant:

- only use an officially documented browser-compatible asset
- do not assume a native app download or Google AI Edge Gallery cache is reusable by the browser
- do not invent LiteRT-LM conversion steps without an official source

## Technical Notes

See [TECH_NOTES.md](TECH_NOTES.md) for:

- official vs engineering-judgment assumptions
- why low-capability devices are blocked
- why browser model assets are treated separately from AI Edge Gallery downloads
