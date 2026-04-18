# App Model Comparisons

This folder holds saved comparison reports for the lighter user-facing app model.

Important separation:

- The main image-eval development target remains **Gemma 4 31B**.
- These saved reports are only for checking how the current lighter app model behaves on the same accommodation extraction task.
- They should be read as production comparisons against the 31B target, not as a separate source of truth.

Current comparison command:

```bash
npm run evals:gemma:image:compare:app
```

That command runs:

- suite: `accommodation_upload`
- model: `gemma4:e2b`
- fresh process per case
- one retry only for runtime or transport failures

and writes:

- `scripts/evals/image/baselines/app-gemma4-e2b-accommodation-baseline.json`
- `scripts/evals/image/baselines/app-gemma4-e2b-accommodation-baseline.md`

Use this when you want a “what does the actual lighter app model do today?” production comparison without changing the default 31B eval target.

The saved JSON report now also includes:

- per-pass extraction attempt summaries for each case
- per-case fresh-process retry history
- transport and failure-mode details so local runtime instability is easier to distinguish from genuine extraction misses
