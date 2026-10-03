import { createAnalytics } from "./browser.js";
export const analytics = createAnalytics({
  "app": "iep-compass",
  "origins": [
    "https://iepcompass.danielnash.co",
    "https://iep-compass-steel.vercel.app",
    "https://iep-compass-danash1611-3756s-projects.vercel.app",
    "https://iep-compass-git-main-danash1611-3756s-projects.vercel.app"
  ],
  "previewPrefix": "iep-compass",
  "pages": [
    "/",
    "/other"
  ],
  "events": [
    "analysis_started",
    "results_viewed",
    "analysis_failed",
    "model_download_started",
    "model_ready",
    "launch_blocked"
  ]
});
