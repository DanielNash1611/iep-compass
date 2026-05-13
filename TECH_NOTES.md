# TECH_NOTES

## What Is Officially Verified

- Google’s current MediaPipe Web guide says the newly released Gemma 4 E2B and E4B browser models are available on Hugging Face for MediaPipe LLM Inference Web.
- The official `@mediapipe/tasks-genai` package README links directly to the Gemma 4 E2B web asset `gemma-4-E2B-it-web.task`.
- The official LiteRT community Gemma 4 E2B model page shows browser support through the LLM Inference Engine and lists the web artifact name `gemma-4-E2B-it-web.task`.
- Google’s Gemma 4 prompt-formatting docs show the current control-token format for chat turns using `<|turn>` and `<turn|>`.

## Why The App Gates Low-Capability Devices

- Gemma 4 E2B is still a heavy browser model, even in web-optimized form.
- Browser inference adds WebGPU, browser-tab, and prompt-cache overhead on top of the model asset itself.
- Lower-memory phones can become unstable or unusable if the app tries to load too aggressively.
- This build therefore blocks loading when `navigator.deviceMemory` reports less than 8 GiB, treats missing WebGPU as a hard stop, and keeps light mode on by default.

This 8 GiB gate is an engineering judgment, not a published Google requirement. It is intentionally conservative.

## Why AI Edge Gallery Downloads Are Treated As Separate

- The browser inference API requires this web app to provide its own browser-compatible model asset by path or buffer.
- The official web docs describe `modelAssetPath` and `modelAssetBuffer`; they do not describe reusing model files managed by another Android app such as Google AI Edge Gallery.
- Because the browser sandbox and another app’s private storage are separate trust and storage boundaries, this project assumes those downloads are not reusable unless Google explicitly documents such sharing later.

That separation is a best-effort engineering judgment based on the official browser API shape, not a direct Google statement about AI Edge Gallery internals.

## Other Engineering Judgments In This Repo

- Light mode defaults to single-turn use, short prompts, and a low total token budget.
- The app caches the downloaded browser model in Cache Storage and asks for persistent storage when the browser supports it. This should last until site storage is cleared or evicted, but it is still browser-managed storage rather than a permanent app install.
- The production launch gate treats the cached model file as readiness and does not instantiate Gemma into WebGPU memory before users upload a photo. That avoids holding the multi-GB model in memory while Android opens the camera/photo picker.
- A cached model can bypass a later remote asset-reachability failure, but it cannot bypass WebGPU, browser-family, secure-context, or memory checks.
- The stable web demo avoids live phone image upload by using synthetic pre-reviewed sample images stored under `public/demo/`. Browser Gemma performs only the reviewed-text accommodation mapping step for that demo.
- Demo mapping is constrained to a seeded list of allowed accommodation IDs. If the model returns an unsupported ID, the app ignores it instead of creating a new accommodation.
- The intended production product direction is a native Android app using Google AI Edge so private image capture, model storage, and on-device inference can be handled by the phone app rather than by browser tab storage and WebGPU memory.
- Detailed byte-level download progress is not shown because the current user-facing path saves and streams the large model through browser storage instead of maintaining a custom progress UI.
- The default model path is same-origin (`/models/gemma-4-E2B-it-web.task`) instead of hot-linking the Hugging Face URL. This keeps deployment simpler and avoids relying on cross-origin behavior for a multi-GB asset.
- The browser model UI is embedded as an optional testing surface inside the existing app rather than becoming the whole product shell. That is an engineering choice to preserve the main user journey while the on-device path is still being validated.
- A local endpoint can be used as a backup for development testing, but it is intentionally outside the user-facing demo and intended product path.

## Why The Model File Stays Out Of Git

- Large `.task` files make normal git history heavy very quickly.
- Every clone, fetch, branch, and CI run becomes slower once the asset is committed.
- Git LFS reduces the worst git-history damage, but it still adds quota, hosting, and contributor setup overhead.

Ignoring `public/models/*.task` is therefore an engineering choice for repo health, not a requirement of the browser API itself.
