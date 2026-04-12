# IEP Compass PRD
**Version:** Final v1  
**Owner:** Daniel Nash  
**Product Type:** IEP-aware accommodation guidance web app  
**Primary Platform:** Responsive web app optimized for phone first, with strong laptop/Chromebook support  
**Status:** Ready for implementation in Codex

---

## 1. Product Summary

IEP Compass helps students, families, and teachers understand when an existing IEP accommodation may be relevant to a specific assignment, worksheet, quiz, test, or classroom task, and how to advocate for it clearly.

The app does **not** create, modify, or determine new accommodations. Instead, it helps users interpret accommodations that already exist in the uploaded IEP excerpt and map them to the task at hand in plain language.

The first version should be designed as a responsive web app that works especially well on a phone, while also supporting Chromebook and laptop use. This enables users to:
- paste text directly
- upload screenshots, photos, PDFs, or files
- take pictures of assignments on a phone
- upload or capture images on a Chromebook when supported

The app should feel:
- clear
- respectful
- empowering
- calm
- trustworthy
- practical

---

## 2. One-Line Product Description

**Upload an IEP accommodations excerpt and an assignment or test, then get a plain-language map of which approved accommodations may be relevant and how to advocate for them.**

---

## 3. Problem Statement

Many students with IEPs do not always know:
- when a specific accommodation may apply
- whether it is relevant to a particular assignment or assessment
- how to ask for it in the moment
- whether the teacher is aware of it
- whether something should have been handled differently until after the fact

This creates avoidable friction:
- missed supports
- confusion during tests and assignments
- delayed self-advocacy
- inconsistent implementation
- preventable stress for students and families

The core problem is not that the IEP does not exist. The core problem is that the IEP is often difficult to translate into moment-by-moment classroom use.

---

## 4. Product Vision

IEP Compass helps a student move from:

**"I'm not sure whether my support applies here."**  
to  
**"I know which approved supports may matter, what to ask for, and how to explain it."**

The product should help students build understanding and confidence, not dependency.

---

## 5. Target Users

### Primary User
Middle school students with IEPs who are learning to understand and advocate for their accommodations.

### Secondary Users
- parents or guardians helping interpret and reinforce supports
- teachers who want a quick reminder of what may be relevant
- counselors or case managers using it as a coaching aid

### Initial Go-To-Market User
Parent + student together, outside of school-system integration.

This should be the default starting point for MVP because it keeps the workflow simpler, more private, and easier to test without school systems.

---

## 6. Core User Jobs

### Student Jobs
- Help me understand whether one of my approved accommodations may matter here.
- Help me notice when I should speak up.
- Help me explain what I need in a respectful way.
- Help me understand my IEP language in plain language.

### Parent Jobs
- Help me coach my child before problems happen.
- Help me verify whether a support might be relevant.
- Help me prepare useful questions for a teacher or counselor.

### Teacher Jobs
- Help me quickly see which existing accommodations may be relevant to this task.
- Help me avoid overlooking a support the student already has.
- Help me identify where I should confirm something with special education staff rather than guess.

---

## 7. Core Value Proposition

IEP Compass turns:
- an IEP accommodations excerpt
- plus a classroom task, quiz, test, worksheet, or assignment

into:
- a plain-language accommodation relevance map
- implementation reminders
- student advocacy language
- teacher awareness notes
- confirm-with-staff flags where appropriate

---

## 8. Product Principles

- **Map, don't invent.** Only reference accommodations explicitly found in the uploaded IEP excerpt.
- **Support, don't decide.** Suggest likely relevance; do not make legal determinations.
- **Advocacy over dependency.** Help the student learn when and how to speak up.
- **Clarity over legalese.** Translate accommodations into plain language.
- **Trust over automation theater.** Prefer transparent rationale to overconfident answers.
- **Privacy by default.** Minimize storage, retention, and unnecessary sharing.
- **Access, not advantage.** Focus on fair access to the task, not helping answer the task itself.

---

## 9. Goals

### Primary Goal
Help students, families, and teachers recognize when existing IEP accommodations may be relevant to a specific task and how to act on that knowledge.

### MVP Goals
- Accept an IEP accommodations excerpt
- Accept assignment/test/worksheet/task content
- Identify which listed accommodations may be relevant
- Explain why in plain language
- Generate student self-advocacy language
- Generate teacher-facing reminders
- Clearly separate likely relevance from uncertain or needs-confirmation cases
- Work well on phones and Chromebooks

### Stretch Goals
- image upload for worksheet/test screenshots
- OCR for uploaded images or PDFs
- side-by-side teacher/student outputs
- saved accommodation profile with explicit consent
- more advanced multimodal document understanding

---

## 10. Non-Goals

IEP Compass is not:
- a replacement for the IEP team
- a legal determination engine
- a school compliance system
- a grading tool
- a cheating tool
- a test-answering assistant
- an automatic enforcement tool
- a diagnosis tool

---

## 11. Success Criteria

### Product Success
- Students can better recognize when to advocate for approved accommodations.
- Parents feel more confident coaching their child before or after assignments/tests.
- Teachers get a faster, clearer view of relevant supports.

### MVP Success
- A user can provide an IEP excerpt and task content and receive a useful result.
- The output references only accommodations found in the uploaded excerpt.
- The output clearly explains uncertainty and when to confirm with staff.
- The app works smoothly on a phone and comfortably on a Chromebook/laptop.
- The app supports image/file-based workflows in addition to pasted text.

### Safety Success
- The app does not invent accommodations not present in the IEP excerpt.
- The app does not provide answers to academic/test content.
- The app does not present itself as binding legal guidance.

---

## 12. Core Workflow

### Input
User provides:
- IEP accommodations excerpt
- assignment, test, worksheet, handout, or task directions
- optional role selection: student / parent / teacher
- optional context: timed, quiz, homework, classwork, group work, etc.

### Supported Input Modes
The app should support:
- pasted text
- uploaded image
- uploaded PDF or file
- screenshot upload
- taking a photo on a phone
- taking or uploading a photo on Chromebook/laptop when supported

### Processing
The system:
- extracts accommodations from the IEP excerpt
- analyzes task characteristics
- maps task features to existing accommodations
- explains why each accommodation may or may not be relevant
- flags uncertainty
- generates role-appropriate guidance

### Output
The system returns:
- relevant accommodations from the uploaded excerpt
- rationale for each
- confidence/certainty label
- student advocacy script
- teacher implementation reminder
- confirm-before-starting notes
- accommodations from the excerpt that do not appear relevant here

---

## 13. MVP Output Structure

### Section 1: Plain-Language Summary
A short explanation of what may matter here.

### Section 2: Potentially Relevant Accommodations
For each accommodation:
- accommodation name
- plain-language explanation
- why it may matter for this task
- confidence label:
  - likely relevant
  - possibly relevant
  - unclear / confirm with staff

### Section 3: Student Advocacy
Examples:
- "I think my extended time accommodation may apply here."
- "Can we confirm whether I can use my approved support for this section?"
- "My IEP says I can receive directions in smaller chunks. Can we do that here?"

### Section 4: Teacher Reminders
Examples:
- what the accommodation may look like in practice
- where to double-check with case manager/special education staff
- where timing, directions, format, or environment may be relevant

### Section 5: Notes and Boundaries
- This is guidance based on the uploaded excerpt.
- This does not create new accommodations.
- Confirm with school staff when unclear.
- The app is not answering the assignment or test itself.

---

## 14. Decision Rules

The system should:
- only discuss accommodations explicitly found in the uploaded IEP excerpt
- avoid guessing legal entitlements
- distinguish between likely relevant and uncertain cases
- avoid high-certainty claims when the task context is incomplete
- focus on access needs, not performance shortcuts
- avoid answering academic/test questions directly

---

## 15. UX Principles

- Calm and confidence-building
- Respectful to middle school students
- Clear over comprehensive
- Transparent over magical
- Role-aware: student, parent, teacher
- Mobile-first
- Minimal jargon
- Never shaming or alarmist

---

## 16. Design Direction

The UI should feel:
- warm
- clean
- supportive
- modern
- trustworthy
- approachable on a phone screen

It should not feel:
- childish
- clinical
- legalistic
- like a chatbot pretending to be a lawyer

A good visual metaphor is:
**"highlighting the supports already in your corner."**

### Visual Style Notes
- pleasant, calm color palette
- rounded surfaces/cards
- strong readability
- generous spacing
- clear hierarchy
- polished but not sterile
- reassuring rather than playful-for-its-own-sake

---

## 17. Platform and Device Requirements

### Primary Platform Direction
The app should be built as a responsive web app with a mobile-first approach.

### Phone Requirements
The app should:
- work comfortably on a phone
- allow camera/photo capture for assignments and worksheets
- support uploading screenshots and images
- keep important actions accessible with one thumb where possible
- use card-based layouts that work well on narrow screens

### Chromebook/Laptop Requirements
The app should:
- support drag-and-drop or standard file upload
- support image upload from device storage
- allow photo capture where browser/device permissions support it
- provide a good document review experience on larger screens
- make side-by-side content easier to inspect when screen space allows

### Responsive Layout Requirements
- mobile-first layout
- stacked sections on small screens
- wider comparative or side-by-side views on larger screens
- large tap targets
- visible upload and capture actions
- clear image/file preview before analysis

---

## 18. MVP Scope

### In Scope for V1
- responsive web app
- phone-first UX
- pasted IEP excerpt text
- pasted task text
- image/file upload flow
- camera/photo flow where supported
- image preview before analysis
- role selection: student / parent / teacher
- accommodation relevance mapping
- plain-language explanations
- student advocacy scripts
- teacher reminders
- uncertainty labels
- clear notes and boundaries
- README / setup notes if built as a repo project

### Out of Scope for V1
- school SIS/LMS integration
- automatic school compliance workflows
- account system
- saved student records by default
- automatic IEP parsing across full school documents
- live classroom monitoring
- answering academic/test content
- legal advice workflows

---

## 19. Safety and Privacy Requirements

### Product Safety
- Do not answer test questions.
- Do not suggest how to game an assessment.
- Do not generate accommodations that are not present in the uploaded IEP excerpt.
- Do not present outputs as binding legal advice.

### Privacy Requirements
- Treat IEP text, assessments, and assignment materials as sensitive student information.
- Minimize storage by default.
- Prefer transient processing for MVP where practical.
- Make it clear what is uploaded, processed, or retained.
- Default to parent/student-controlled uploads and usage.

---

## 20. Technical Approach

### MVP Input Formats
- pasted text
- uploaded image
- uploaded PDF/file
- photo capture where supported

### Phase 1.5
- OCR extraction from uploaded images/PDFs
- better preview and cropping flows
- more refined phone camera workflow

### Phase 2
- structured document upload
- richer role-specific views
- saved accommodation profiles with explicit consent
- more advanced multimodal extraction

### Architecture Preference
For speed and usability, build as a standard responsive web app. The first release should prioritize practical capture and upload workflows over deeper system integration.

---

## 21. Risks

### Product Risks
- overconfidence when the IEP excerpt is incomplete
- teacher distrust if the tool sounds too definitive
- student overreliance instead of self-advocacy growth
- outputs that are too vague or too legalistic

### Safety Risks
- implying a support is required when context is ambiguous
- failing to warn when staff confirmation is needed
- answering assessment content instead of support questions

### Privacy Risks
- storing sensitive student records unnecessarily
- unclear retention model
- school-side usage before privacy posture is mature

### UX Risks
- overcomplicating the mobile flow
- making document capture/upload feel fragile
- creating too much text on small screens

---

## 22. Acceptance Criteria

A build is acceptable when:
- the user can provide an IEP accommodations excerpt and a task
- the app identifies only accommodations present in the excerpt
- the app explains likely relevance in plain language
- the app generates a student advocacy script
- the app generates a teacher reminder view
- the app clearly labels uncertainty
- the app avoids answering the academic questions themselves
- the app works smoothly on a phone
- the app supports Chromebook-friendly upload workflows

---

## 23. Example Scenarios

### Scenario 1
Student uploads an IEP excerpt including:
- extended time
- directions clarified or chunked
- reduced-distraction setting

Then uploads a timed math quiz with dense directions.

Expected output:
- extended time likely relevant
- chunked directions may be relevant
- reduced-distraction setting may be relevant
- student script for asking before the quiz starts

### Scenario 2
Student uploads an IEP excerpt including:
- text-to-speech for non-reading-comprehension tasks
- graphic organizer support
- check-ins for multi-step work

Then uploads a science lab handout as a photo.

Expected output:
- graphic organizer/check-in supports may be relevant
- text-to-speech may depend on what the task is measuring
- teacher reminders emphasize confirming context if needed

### Scenario 3
Parent uploads an ELA test prompt plus accommodations excerpt.

Expected output:
- relevance map
- plain-language explanation
- confirm-before-starting flags
- no help answering the prompt itself

### Scenario 4
Student takes a picture of a worksheet on a phone before class begins and checks whether any approved accommodations appear relevant.

Expected output:
- quick mobile-friendly summary
- relevant accommodations
- self-advocacy language
- clear note where confirmation is needed

---

## 24. Metrics

### Qualitative
- user confidence in understanding applicability
- perceived clarity of advocacy language
- parent trust
- teacher trust
- perceived ease of use on a phone

### Quantitative
- percentage of outputs that only cite accommodations present in the excerpt
- percentage of outputs with explicit uncertainty where appropriate
- time to useful result
- completion rate for mobile capture/upload flow
- rate of users saying the guidance was helpful before class/test rather than after

---

## 25. Open Questions

- Should the MVP be branded for students first, or parent-student pairs?
- Should the first version focus on assessments only, or any school task?
- Should teacher mode be included in MVP or remain an output option only?
- How much explanation is enough before the UI feels too dense on a phone?
- What is the best image/OCR flow for phones and Chromebooks?
- How should uncertainty be shown so it feels useful rather than frustrating?

---

## 26. Product Thesis

**IEP Compass helps students, families, and teachers understand when an existing IEP accommodation may be relevant to a specific assignment or assessment, and how to advocate for it clearly.**
