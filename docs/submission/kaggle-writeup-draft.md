# IEP Compass: Grounded Accommodation Guidance With Gemma 4

**Subtitle:** A local-first education tool that helps students understand when approved IEP accommodations may apply to real classroom work.

**Track:** Future of Education, with a Safety & Trust emphasis.

## Summary

IEP Compass helps students, families, and teachers answer a practical question: "Which of my approved IEP accommodations may matter for this assignment, and how can I ask for them clearly?"

Many students have accommodations on paper but still miss supports in the moment. The problem is not that the IEP does not exist. The problem is that legal or formal accommodation language is hard to translate into a specific worksheet, quiz, writing prompt, or classroom task.

IEP Compass turns an approved IEP excerpt plus an assignment into a plain-language accommodation map. It identifies likely relevant accommodations, explains why they may matter, gives a student-friendly script, and shows what still needs confirmation with staff. It does not create new accommodations, answer schoolwork, diagnose, or make legal determinations.

## How Gemma 4 Is Used

The app is built around a local-first Gemma 4 story. Browser Gemma 4 E2B runs short reviewed-text mapping on supported devices through the official MediaPipe / Google AI Edge web inference stack and the browser-ready `gemma-4-E2B-it-web.task` asset. The browser path is intentionally gated by WebGPU, browser support, model availability, and conservative device-memory checks so lower-capability phones are not pushed into unstable model loading.

For the presentation walkthrough, IEP Compass uses synthetic sample images for a student named Jordan. These images are not silently trusted and do not include hidden reviewed text. When a local Gemma/Ollama endpoint is configured, the app can read those images into review drafts. The user still reviews the extracted text before it enters the source trail. Browser Gemma 4 E2B then maps the reviewed source text to a constrained set of approved accommodation IDs, rejecting model-suggested IDs outside the allowed list.

This separation is deliberate. Current MediaPipe web documentation supports Gemma 4 E2B browser text inference, while browser image prompting is documented for Gemma-3n rather than this Gemma 4 E2B web task. IEP Compass does not claim private browser image interpretation until that path is officially documented. The intended production direction is a native Android app using Google AI Edge for private capture, model storage, and on-device image inference.

## Architecture

The main app is a Vite, React, and TypeScript single-page app with a three-step phone-first flow:

1. Review approved accommodation wording.
2. Add the assignment, quiz, worksheet, or task details.
3. Check what may apply and what to do next.

The key trust boundary is reviewed source text. Uploads can be photos, screenshots, PDFs, or text files, but extracted content only affects the final analysis after the user reviews and includes it. IEP details, task details, and reviewed attachments are normalized into a source trail before the analysis adapter runs.

The analysis layer has three parts:

- A schema-validated result contract for accommodation suggestions, uncertainty, student scripts, parent notes, teacher notes, and source boundaries.
- A Gemma adapter that uses live Gemma paths when configured and deterministic fallback behavior only to keep the demo runnable.
- A seeded Jordan mapping path where Browser Gemma selects from allowed accommodation IDs instead of inventing new supports.

The document-reading layer is measured separately. Accommodation image evals ask Gemma for reviewable plain text, while assignment image evals classify the visible document, capture access-relevant details, and ask focused follow-up questions such as whether a task is timed or whether spelling is part of a rubric. The default image-eval target is Gemma 4 31B, and the lighter `gemma4:e2b` app path is tracked as a production comparison snapshot.

## Safety And Trust

IEP Compass is designed to be useful without overclaiming. It follows four product rules:

- Map, do not invent. Only approved accommodations from reviewed source materials can be referenced.
- Support, do not decide. The app suggests likely relevance but does not make legal or compliance determinations.
- Access, not advantage. The app helps a student ask for fair access, not answers to the assignment.
- Preserve uncertainty. When context is incomplete, the output uses language like "may apply" and "worth confirming."

These rules appear in prompts, schemas, UI copy, and tests. The app also keeps uploaded files session-local in the current web implementation and avoids committing large model assets into the public repository.

## What Was Hard

The hardest engineering challenge was making the demo both honest and compelling. It would have been easy to preload perfect text, but that would hide the real model behavior. Instead, the Jordan walkthrough uses real sample images, a labeled local image-reading path, visible review drafts, and an optional correction button only after the first model pass. That keeps the story demoable while preserving the source-review trust boundary.

Another challenge was browser model feasibility. The app does not assume that a model downloaded by another Android app can be reused by the browser, and it does not assume undocumented Gemma 4 E2B browser image input. The architecture is candid about what runs in browser today and what belongs in a future native Android version.

## Validation

The repo includes unit tests for schema parsing, source-trail handling, document-reading recovery, production launch gates, demo mapping, accommodation prompt behavior, and image-eval scoring. Before submission, the core checks passed:

- `npm run lint`
- `npm run test`
- `npm run build`

The fresh app-model image baseline records a `gemma4:e2b` accommodation pass rate of 0.5, with condition preservation at 1.0 but known remaining OCR, hallucination-filtering, and uncertainty failures on difficult phone-photo cases. Those failures are documented rather than hidden, and they directly shape the next product direction.

## Impact

IEP Compass is not trying to replace educators or IEP teams. It gives students and families a calmer bridge between formal accommodation language and the real moment when a student needs to speak up. That is why Gemma 4 matters here: local intelligence can make private, context-specific guidance available at the edge, close to the classroom moment where it can actually help.
