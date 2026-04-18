# IEP Compass Agent Guide

Use this file as the operating guide for any agent or contributor making changes in this repo.

## Read these first

- `PRD.md` is the main product source of truth for scope, users, goals, workflow, and non-goals.
- `docs/BRAND_GUIDE.md` is the main brand source of truth for voice, visual language, typography, color, motifs, and accessibility.
- `NEXT_STEPS.md` is the active progress tracker. Read it before starting work so you know what just finished, what is in focus now, and what should happen next.
- `README.md` explains the current technical shape of the app, especially the browser-first Gemma testing path and model-asset constraints.
- `TECH_NOTES.md` separates officially verified facts from repo-specific engineering judgment.
- `scripts/evals/image/README.md` explains the Gemma 4 31B image-eval loop, case format, fixture layout, and reporting workflow for document-reading quality work.

If these docs pull in different directions, use this order:

1. PRD for product behavior and scope.
2. Brand guide for UX tone, look, and content style.
3. README and TECH_NOTES for current implementation constraints.

## Product intent

IEP Compass helps students, families, and teachers understand when an existing IEP accommodation may be relevant to a specific assignment, worksheet, quiz, test, or classroom task, and how to advocate for it clearly.

This product maps and explains. It does not invent, decide, diagnose, answer assignments, or act as a legal/compliance engine.

## Non-negotiable product guardrails

- Only reference accommodations explicitly present in the reviewed IEP source materials.
- Never invent new accommodations, entitlements, diagnoses, or legal conclusions.
- Never answer the academic task itself. Focus on access supports, not performance advantage.
- Preserve uncertainty. Prefer language like "may apply," "appears relevant," and "worth confirming with staff" when context is incomplete.
- Optimize for middle-school readability without sounding childish.
- Keep privacy expectations conservative. Do not casually introduce storage, sharing, or retention behavior that conflicts with the app's current privacy-first posture.
- Keep the trust boundary visible in the UX and in the copy. Users should understand what the app can and cannot claim.

## Brand and UX guardrails

- Build for phone-first use first, then make sure the same flow works well on Chromebook and laptop.
- Follow the brand guide closely. The app should feel calm, encouraging, respectful, practical, and trustworthy.
- Write like a steady guide standing next to the student, not like a legal tool or generic AI assistant.
- Use `Newsreader` for branded headline moments and `Manrope` for body/UI unless there is a deliberate system-wide typography change.
- Keep the visual system warm and notebook-like. Favor Compass Green, Deep Ink, Cloud Cream, and Paper as the main anchors.
- Use path, waypoint, compass, and checkpoint motifs lightly. They should guide orientation, not feel cartoonish or gamified.
- Keep trust and caution states calm. Avoid harsh warning-box aesthetics unless the product direction changes.
- Maintain strong accessibility basics: contrast, focus states, readable mobile text, comfortable touch targets, and labels that do not rely on color alone.
- Keep layouts scannable. Short paragraphs, clear sectioning, and easy-to-spot source grounding matter more than density.

## Codebase map

- `src/App.tsx`: main three-step product shell and flow orchestration.
- `src/features/input/*`: task setup and intake fields.
- `src/features/source/*`: reviewed source text editing and source-grounding UI.
- `src/features/upload/*`: file upload and attachment handling.
- `src/features/results/*`: result rendering, trust framing, and role-aware output presentation.
- `src/lib/analysis/*`: analysis adapter, prompt construction, and mock analysis behavior.
- `src/lib/schema/analysisSchema.ts`: Zod contract for model output.
- `src/lib/schema/imageInterpretationSchema.ts`: Zod contracts for Gemma image-interpretation eval outputs.
- `src/features/on-device/*` and `src/lib/on-device/*`: optional browser-first Gemma testing surface and device/model gating.
- `scripts/evals/image/*`: Gemma 4 31B image-interpretation eval harness, prompts, scoring, reporting, and fixture-backed cases.

## Implementation rules

- Keep the main IEP Compass flow as the primary UX. The on-device Gemma panel is an optional testing surface unless the PRD changes.
- If you change the analysis output shape, update all affected layers together:
  `src/lib/analysis/*`, `src/lib/schema/analysisSchema.ts`, `src/types/analysis.ts`, mocks, renderers, tests, and evals.
- If you change prompt behavior or safety logic, verify the change still enforces the PRD principles:
  map, do not invent; support, do not decide; access, not advantage.
- Keep the E2B user-facing path separate from the Gemma 4 31B image-eval path. Image evals are for measuring document interpretation directly and should not silently inherit the browser/E2B model choice.
- If you change copy, re-check it against the brand guide's voice and tone section.
- If you change visuals, re-check the brand guide before introducing new colors, typography, or stylistic motifs.
- If you change anything about uploads, source review, or privacy messaging, preserve the app's grounding model and user trust cues.
- If you change image interpretation prompts, schemas, scoring, or fixture expectations, update the image eval cases or docs in the same pass so the development loop stays runnable.
- Do not commit large model assets or assume `public/models/gemma-4-E2B-it-web.task` exists locally.
- Keep engineering judgments labeled as judgments when they are not explicitly guaranteed by upstream docs.

## Working style for future changes

- Start by tracing the relevant product requirement back to the PRD and the brand requirement back to the brand guide.
- Read `NEXT_STEPS.md` before you start so the work stays aligned with the current implementation focus.
- Prefer small, source-grounded changes over clever behavior that is hard to explain.
- When behavior is ambiguous, choose the option that is easier to justify from the user's uploaded materials.
- When visual choices are ambiguous, choose the option that feels calmer, clearer, and more student-friendly on a phone.
- Do not silently broaden scope into school workflows, compliance tooling, or answer-generation.
- Keep role differences useful but modest. Student, parent, and teacher views should stay grounded in the same source facts.

## Workflow tracking

- Treat `NEXT_STEPS.md` as a living tracker, not as archive prose.
- Before making changes, check the tracker so you know the latest completed work and the current focus.
- After finishing work, update `NEXT_STEPS.md` with:
  - what you completed,
  - what should happen next,
  - and any short open questions that would help the next pass.
- Keep tracker notes concise, practical, and implementation-oriented.
- Treat `scripts/evals/image/cases/*` and `scripts/evals/image/fixtures/*` as part of the living eval dataset. Keep case expectations and fixture content aligned.

## Definition of done

Before closing a meaningful change, make sure the app still:

- reflects the PRD's scope and non-goals,
- matches the brand guide's tone and visual direction,
- keeps trust boundaries explicit,
- works well on mobile layouts,
- stays grounded in reviewed source materials,
- avoids answer-giving and invented accommodations,
- has an updated `NEXT_STEPS.md` entry when the change materially shifts progress or priorities,
- runs the relevant Gemma 4 31B image eval command when image interpretation, upload prompts, or document-reading scoring changed,
- and passes the relevant local checks (`npm run lint`, `npm run build`, `npm run test`) when the touched area warrants them.
