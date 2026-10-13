# Maintenance — October 13, 2026

Vite is now required at `^8.3.4` and locked to 8.3.4. The previous 8.3.1
copy was affected by the October 6 development-server advisories
[GHSA-rq7h-c2jc-7f22](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22)
and [GHSA-vfpm-58rq-9qcg](https://github.com/vitejs/vite/security/advisories/GHSA-vfpm-58rq-9qcg),
both fixed in 8.3.3. The targeted resolution also refreshes Vite's PostCSS/Nanoid
dependencies; application, inference, PDF.js and MediaPipe versions are unchanged.

An isolated copy of remote `main` at
`5c1431d63666bba80c282d9466f9024f83839239` preserves local uncommitted work.
Vercel production metadata still reports that base READY with Node 24.

Clean installs, typecheck, lint, all 90 offline tests, build and existing loopback
smoke pass on Node 22.23.3 and 24.21.0. Fresh full npm audits report zero findings.
Headless Chromium checks confirm the production setup gate remains closed until
model setup, an unavailable model keeps the main flow blocked, and PDF.js 6.3.289
renders a synthetic one-page PDF using the emitted hashed worker (HTTP 200).
Model availability is mocked; no model was downloaded or inference performed.

Next: review the local commit. Publishing and deployment require separate authorization.
