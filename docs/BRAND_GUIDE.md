# IEP Compass Brand Guide

## Brand Purpose

IEP Compass helps students and families figure out when approved IEP accommodations may matter for a real school assignment. The product should feel like a steady guide: clear enough for a middle school student, trustworthy enough for a parent or educator, and careful about what it can and cannot claim.

## Brand Personality

- Encouraging
- Clear
- Calm with energy
- Student-friendly
- Empowering
- Trustworthy without sounding formal or clinical

## Signature Visual Motifs

- Guided path: subtle curved lines, route cues, and “next step” framing
- Waypoints: step markers, checkpoint chips, and completion states
- Compass cues: directional stars, needle shapes, and radial accents
- Stars and checkpoints: small celebratory markers that suggest progress, not gamification
- Notebook feel: soft paper tones, ruled textures, rounded labels, and school-supply warmth

Use motifs sparingly. They should add orientation and optimism, not turn the app into a cartoon.

## Color Palette

### Primary

- Compass Green: `#2F6E62`
- Deep Ink: `#21313A`
- Cloud Cream: `#F8F6F1`

### Secondary

- Sky Blue: `#7EC8E3`
- Sunshine Gold: `#F4C95D`
- Coral Pop: `#F28C8C`
- Lavender Mist: `#B8A8E3`
- Mint Tint: `#DDF3EA`

### Neutrals

- Paper: `#FFFDFC`
- Fog: `#E9E5DC`
- Soft Gray: `#A7A29A`
- Slate Text: `#4B5563`

### Usage Notes

- Use Compass Green and Deep Ink for structure, trust, and primary actions.
- Use Cloud Cream and Paper as the dominant surfaces for a warm, notebook-like base.
- Use Sky Blue, Sunshine Gold, Coral Pop, and Lavender Mist as small directional accents across steps, helper chips, and result highlights.
- Do not rely on accent colors alone to signal meaning; pair color with icons, labels, and text.

### Semantic Token Usage

- `primary`: Compass Green for primary actions, key markers, and trusted direction cues
- `text`: Slate Text for body copy and supporting UI copy
- `surface`: Paper for the clearest, most readable card or field surface
- `surface-muted`: Cloud Cream or Fog for notebook-like panels and background sections
- `info`: Sky Blue for path cues, helper surfaces, and instructional notes
- `success`: Mint Tint for grounded, reassuring, safe-to-proceed moments
- `highlight`: Sunshine Gold for checkpoints, “look here first” emphasis, and celebratory warmth
- `warning-soft`: Coral Pop for gentle caution, recheck states, and corrective notes without alarm styling
- `accent`: Lavender Mist for secondary emphasis, alternate routes, and detail panels

### Accent Placement

- Sky Blue should appear in hero atmosphere, helper badges, path lines, and reasoning/detail panels.
- Sunshine Gold should appear in checkpoint labels, hero spark moments, and “recommended first” emphasis.
- Coral Pop should appear lightly in correction flows, follow-up guidance, and soft caution moments.
- Lavender Mist should appear in alternate/secondary emphasis, role-aware views, and supporting detail cards.
- Mint Tint should appear in trust, grounding, source-review, and “safe guidance” surfaces.

## Typography Guidance

- Branded moments and hero headlines should lean on a friendly serif or display feel.
- Body copy, form labels, helper text, and buttons should use a clean sans-serif.
- Default body sizing should feel larger and more comfortable than enterprise software.
- Keep paragraphs short and highly scannable on mobile.
- Use spacing and size, not all caps, as the main hierarchy tool.

Implementation direction for the current app:

- Headings and product title: `Newsreader`
- Body and UI: `Manrope`

## Iconography Guidance

- Use rounded, line-based icons with soft corners and simple geometry.
- Preferred icon moments: steps, trust items, inputs, upload, microphone, assignment, results, source review, and accommodation cards.
- Icons should aid scanning first and decoration second.
- Keep icon sizing consistent inside pills, cards, and buttons.

## Spacing and Shape Direction

- Lean on generous vertical rhythm and comfortable mobile padding.
- Prefer rounded corners that feel approachable rather than sharp or highly technical.
- Use layered surfaces and gentle shadows to separate content without making the UI feel heavy.
- Keep dense data grouped into short stacks, small grids, and clear labeled blocks.

## Expressive Motif Layer

- Decorative path lines should be visible in the hero and stepper, then echoed in smaller ways inside helper cards and checkpoints.
- Stars, compass sparks, and waypoint dots should create warmth and momentum, but never distract from reading the content.
- Notebook cues should come through ruled textures, paper tones, pinned-note treatments, and rounded study-tool shapes.
- Use asymmetry lightly: a hero illustration cluster, offset accent glows, or a side path line can make the product feel more alive.

## Component Styling Notes

### Hero

- The first screen should feel branded and welcoming, with a strong title, warm supporting copy, and a visible sense of guidance.
- Use subtle background shapes, path lines, and compass accents to create energy.

### Stepper

- Present the 3-step flow as a journey with numbered milestones.
- Every step should include number, icon, label, and a clear state for upcoming, active, and completed.
- Connect milestones with a visible path line or route connector so the flow feels continuous.
- Give each step a slight accent-color identity while keeping the overall journey cohesive.
- Completed steps should feel affirming, active steps should feel energized, and upcoming steps should still look inviting rather than disabled.

### Inputs

- Text entry areas should feel like guided notebook panels, not plain utility boxes.
- Helper text should explain what the app will rely on and what uploads do.
- Upload areas should look inviting and safe, with clear entry points for photo, file, and voice support.
- Use supportive chips, icon-led hints, and tinted wrappers so inputs feel coached rather than clinical.
- Keep the reviewed text area visually distinct from supporting uploads so students understand what the app will cite back.

### Results

- Present accommodations as supportive checkpoint cards with short labeled sections.
- Keep “why it may apply,” “why it matters,” and “source text” easy to scan.
- Preserve grounding and trust boundaries in both copy and structure.

### Trust Boundaries

- Keep this content visible and reassuring.
- Present it with shield/checkpoint cues and calm explanatory language rather than warning-box styling.
- Prefer Mint Tint, Cloud Cream, and Sky Blue accents over dark or severe warning treatments.

## Voice and Tone Guidance

Write like a calm guide standing next to the student.

Preferred tone:

- “Let’s start with the approved IEP details.”
- “Here’s what may apply for this assignment.”
- “This looks worth checking with your teacher.”
- “We only use accommodations shown in your source materials.”

Avoid:

- “The system has determined…”
- “Based on the provided documentation…”
- “This functionality is limited to…”

## Accessibility Notes

- Maintain strong contrast for all core text and controls.
- Keep body text readable on small phones without pinch zoom.
- Preserve visible focus states on every interactive element.
- Do not communicate state with color alone; pair it with labels, icons, and wording.
- Keep touch targets comfortable for mobile use.
- Use short helper text blocks and scan-friendly groupings to reduce cognitive load.
