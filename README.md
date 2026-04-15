# IEP Compass with Browser-First Gemma 4 Testing

This repo keeps the main IEP Compass experience intact while adding an embedded browser-first testing panel for **Gemma 4 E2B** on supported devices, using the official **MediaPipe / Google AI Edge** web inference stack.

## Current Feasibility

**Yes, Gemma 4 E2B browser inference is currently feasible.**

What is verified:

- Google’s MediaPipe Web docs point to newly released Gemma 4 E2B and E4B browser models for LLM Inference Web.
- The official `@mediapipe/tasks-genai` package README links directly to a Gemma 4 E2B browser asset.
- The official LiteRT community model page lists the browser-ready file as:
  - `gemma-4-E2B-it-web.task`

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
- A local endpoint can be configured as a backup for development testing only.

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

- `VITE_GEMMA4_WEB_MODEL_PATH`
- `VITE_MEDIAPIPE_WASM_ROOT`
- `VITE_GEMMA_BASE_URL`
- `VITE_GEMMA_API_KEY`
- `VITE_GEMMA_PRIMARY_MODEL`
- `VITE_GEMMA_FALLBACK_MODEL`
- `VITE_GEMMA_MULTIMODAL`
- `GEMMA_PROXY_TARGET`

Default values:

- `VITE_GEMMA4_WEB_MODEL_PATH=/models/gemma-4-E2B-it-web.task`
- `VITE_MEDIAPIPE_WASM_ROOT=https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.27/wasm`
- `VITE_GEMMA_BASE_URL=/api/ollama`
- `VITE_GEMMA_PRIMARY_MODEL=gemma4:e2b`
- `GEMMA_PROXY_TARGET=http://127.0.0.1:11434`

Local backup notes:

- `VITE_GEMMA_BASE_URL` is optional and exists only for development fallback testing.
- With the default Vite proxy, `/api/ollama` forwards to `http://127.0.0.1:11434/v1`.
- This backup path is helpful when browser inference is blocked on a device, but it is not the competition delivery path.

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

- model loading is explicit and user-triggered
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
  - optional local endpoint fallback for development testing
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
