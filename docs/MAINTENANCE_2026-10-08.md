# October 8, 2026 maintenance verification

This dated entry supersedes older maintenance reproduction instructions for this pass and preserves their historical results.

## Baseline and changes

Prepared in an independent local clone on `codex/maintenance-2026-10-08` from verified current `origin/main` at `5ec64c82a3ddac24168e375238173ca94a3207c1`. The latest READY production deployment reported by read-only Vercel metadata has the same branch and commit SHA.

`.nvmrc` now selects Node 22.23.3. CI uses exact `actions/checkout@v7.0.1` and `actions/setup-node@v7.1.0` releases. The previous workflow already used v7; this change bounds each Action to its verified release.

## Reproduction and observed checks

Locally verified with the official SHA256-checked Node **22.23.3** Darwin arm64 distribution and its npm **10.9.9**. `npm ci` and `npm run check` passed. The check runs `typecheck`, `lint`, `test`, `build`, and `smoke` in order; the smoke requests the actual production build on loopback. No research, model inference, sign-in, contact submission, or database operation was performed. Coverage includes 90 deterministic tests.

Verification used a credential-free environment and no copied local `.env` files. The four app suites retain their existing guards against unmocked integration requests. Exegesis uses local fixtures, mock analytics sends, and loopback transport integration; an external verification preload blocked non-test network/socket destinations. No live database, mail, AI, or Ollama endpoint was used.

Final `npm audit --audit-level=low --json` exited 0: 0 findings (0 moderate, 0 high, 0 critical).

No findings were reported by the current npm advisory database; this is not a complete application-security assessment.

Full logs and raw audits are retained in `/Users/danielnash/Documents/Codex/2026-10-08/task-2/evidence/`: `iep-compass-clean-install.log`, `iep-compass-audit.json`, and `iep-compass-run-check.log`.

## Limits

No push, PR, merge, deployment, settings change, or permission change occurred. Vercel read-only metadata reports project Node 24.x; those settings were preserved. Hosted Linux Actions and deployed behavior remain unverified. Existing local checkouts, their dirty files, and unpublished commits were preserved. Semantic/model quality was not evaluated; existing opt-in evaluation commands and prior quality evidence remain separate. Vite retains bundle-size and mixed static/dynamic import warnings.

## Verified upstream sources

- [Node 22.23.3 release](https://nodejs.org/en/blog/release/v22.23.3).
- [checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) and [setup-node 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0).

## MediaPipe review scope and recommendation

Google's [MediaPipe Web guide](https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/web_js) labels LLM Inference as maintenance-only and recommends [LiteRT-LM's JavaScript API](https://developers.google.com/edge/litert-lm/js). This pass makes no inference migration and downloads/runs no model. The package, WASM/model paths, adapters, prompts, gating, and evaluation datasets remain unchanged.

Engineering recommendation: plan a separate review before implementing a migration. Compare the intended native Android product direction with a web migration. For a web path, review `modelBootstrap.ts`, `inferenceSession.ts`, `modelConfig.ts`, `modelAssetCache.ts`, capability/readiness checks, and their adapters/tests. The documented replacement uses `@litert-lm/core`, `Engine`/`Conversation`, `.litertlm` artifacts, and different loading/streaming/cancellation/disposal APIs; it is not a drop-in package bump. Assess model-cache invalidation, WASM version alignment, resource cleanup, token/sampling limits, WebGPU/memory/device support, and source-review/privacy boundaries.

Acceptance must preserve PRD source grounding and no-answering rules. Deterministic adapter/lifecycle tests cannot establish model quality. Run a separately approved semantic comparison using unchanged 31B quality targets and the separately labeled E2B product comparison only when model execution is authorized.
