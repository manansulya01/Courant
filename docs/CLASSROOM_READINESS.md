# Courant release checklist

This checklist separates repository checks from launch tasks that require real credentials, a deployed environment, or physical devices. A green build is not a school-readiness certification.

## Eight workstreams

### 1. Build, lint, dependency and route checks
- [x] GitHub Actions runs ESLint, the security/input unit tests, and a production Next.js build on pushes to `main` and pull requests.
- [ ] Add a production dependency audit and HTTP smoke tests for key routes, security headers, auth boundaries, and unavailable-provider responses; these are not yet part of CI.
- [x] Learner JSON APIs use a shared streaming byte limit instead of trusting `Content-Length` or buffering unbounded request bodies.
- [x] Node test suite covers valid objects, malformed JSON, non-object JSON, declared-size rejection, and streamed oversized bodies.
- [x] Teacher write/delete handlers apply rate limits before bounded streaming JSON parsing; classroom cascades use PostgreSQL foreign-key cascades and row-level security.
- [ ] Commit a lockfile and move CI to `npm ci` after dependency versions are intentionally pinned.
- [ ] Add unit/integration tests against a disposable Supabase staging project with mocked provider responses; verify tenant isolation, class-join rules, submission integrity, and account deletion.

### 2. Authentication, authorization and tenant isolation
- [x] Supabase Auth replaces custom MongoDB password hashes and signed session cookies.
- [x] Profiles, classes, memberships, assignments, submissions, progress, portfolio, and rate limits use PostgreSQL with row-level security.
- [x] Student self-registration cannot assign teacher/admin roles; one-time invitation hashes are redeemed inside the Auth user-creation trigger.
- [x] Shared rate limiting uses a PostgreSQL function with fixed endpoint scopes/thresholds and a server-only credential whose hash is checked in the database.
- [ ] Configure Supabase Auth redirect URLs and production SMTP; test signup confirmation and password recovery end-to-end.
- [ ] Run multi-account tests proving students and teachers cannot access another user's portfolio, class, submissions or progress by changing IDs.
- [ ] Import legacy MongoDB accounts and records if the old database becomes available; existing MongoDB credentials are not migrated automatically.
- [ ] Reconstruct and check in the complete ordered Supabase bootstrap migration history; the repository currently contains only the latest RLS hardening migration, so a clean database cannot yet be recreated from Git alone.

### 3. AI conversation and speech reliability
- [x] English conversation page supports push-to-talk, transcription, spoken replies, replay and text/browser speech fallback.
- [x] AI endpoints bound request sizes, validate image/audio inputs, avoid caching learner responses and time out upstream provider calls.
- [ ] Configure and cap AI provider spend; test provider 401/429/5xx, timeout, offline, interrupted recording and retry flows.
- [ ] Verify voice quality, latency, pronunciation-feedback claims and speech support on actual target iPads.

### 4. Database resilience and privacy
- [x] Courant production uses Supabase PostgreSQL 17 in the Mumbai region; RLS is enabled on every application table.
- [x] Account deletion removes the Supabase Auth user and cascades related profile, class, submission, progress and portfolio records.
- [x] Supabase security and performance advisors were run. The rate-limit SECURITY DEFINER RPC remains callable by `anon` because unauthenticated routes need throttling, but rejects calls without the server-only credential, validates fixed scopes/limits, and fails closed.
- [ ] Configure and test database backups, monitoring, restore procedures, and production SMTP.
- [ ] Import legacy MongoDB records if a verified export becomes available.
- [ ] Verify transcripts/raw recordings are not retained unless explicitly designed, consented to and documented.

### 5. Web/API security and operational controls
- [x] Baseline response headers include frame denial, MIME sniffing protection, referrer policy and restrictive camera/microphone/geolocation permissions; HSTS is production-only.
- [x] High-cost tutoring and coaching endpoints use same-origin checks and shared rate limiting.
- [x] Live video practice falls back to a local animated avatar when streamed-avatar credentials or service are unavailable; the learner camera and Gemini Live voice path remain separate.
- [ ] Verify HTTPS, deployment proxy/body limits, CSP compatibility, secret rotation, alerting and privacy-preserving logs in the real host environment.
- [ ] Run a security review and dependency audit against the exact release commit before launch.

### 6. UI, accessibility and classroom workflows
- [x] Production smoke tests check the main learner, teacher, account and voice routes render.
- [ ] Test keyboard-only operation, screen reader labels, contrast, zoom, reduced motion and touch-target sizes.
- [ ] Test assignment creation/submission/review, class joining and feedback end-to-end with teacher and student accounts.
- [ ] Complete visual regression checks at supported desktop, tablet and phone breakpoints.

### 7. iPad/Safari and real-device verification
- [x] Voice UI includes text input and fallback messaging when microphone/voice services are unavailable.
- [ ] Test current supported iPadOS/Safari versions on physical devices over HTTPS.
- [ ] Verify microphone permission grant/denial, audio playback unlock, screen orientation, backgrounding, reconnect, long sessions and Bluetooth/headset behavior.
- [ ] Verify camera/photo selection and image size/type handling on-device.

### 8. Student privacy, safety and release sign-off
- [x] Tutor instructions specify age-appropriate language, avoid requests for personal information and avoid claiming to measure pronunciation from text.
- [x] Text-based speaking indicators are disclosed as estimates rather than objective speech measurements.
- [ ] Complete a school/guardian privacy impact review, age-appropriate consent process, retention schedule and jurisdiction-specific legal review.
- [ ] Review child safety/content moderation, escalation language, teacher oversight, accessibility and data subject request handling.
- [ ] Run a limited pilot with non-sensitive test accounts, an incident response plan and an explicit rollback owner before enrolling real students.

## No-backend fallback modes

- [x] `/offline-practice` provides individual lessons without sign-in, API calls, or database access; progress and drafts are stored locally in the browser.
- [x] Learners can export and restore a versioned local progress backup to move between devices.
- [x] `/offline-classroom` provides a manual assignment-file workflow: teachers export assignment JSON, learners import and complete it, and teachers import submissions and export a class bundle.
- [ ] Pilot file exchange with teachers and learners on the actual school devices and validate the school-approved file-sharing process.
- [ ] Confirm the school's privacy and retention requirements before using any learner-identifying labels in exported files.

These fallbacks do not depend on the broken database connection or hosted AI provider. They are intentionally not described as synced accounts, secure student identity, automatic grading, or a managed classroom platform.

## Required environment configuration

- `MONGODB_URI`, `MONGODB_DB`
- `AUTH_SECRET` (random, at least 32 characters)
- `OPENAI_API_KEY` and optionally `OPENAI_MODEL`, `OPENAI_TTS_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL` for password recovery email
- `COURANT_TEACHER_INVITE_CODE` if teacher invitation gating is enabled

Never commit these values or expose them through `NEXT_PUBLIC_*`. Configure them in the deployment provider's secret manager. The automated suite intentionally runs without production credentials; its expected 503/401 responses are checks of safe failure behavior, not proof that live integrations work.


## Live AI teacher capability boundary

The live coach supports real-time spoken conversation through WebRTC, learner-level adaptation, live transcription in the page, and an optional post-call learning recap. When LiveAvatar is configured, video mode renders a continuously animated AI teacher with synchronized speech. The learner camera remains a separate optional preview; compressed still frames may also be sent roughly every six seconds to the OpenAI coach for visual context. Without LiveAvatar credentials, animated teacher video is unavailable. Camera permission is requested by the browser and can be paused independently during the call. The recap is generated only when the learner asks for it and remains in the page; the live transcript is not automatically persisted.

### Required release verification

- [ ] Configure a server-side `GEMINI_API_KEY` with Gemini Live access and verify `/api/tutor/realtime-session` returns a short-lived client secret.
- [ ] Configure MongoDB Atlas, `AUTH_SECRET`, and production HTTPS.
- [ ] Test voice call, mute, interruption, end-call cleanup, camera pause/resume, and recap generation on physical iPadOS/Safari and desktop browsers.
- [ ] Confirm that provider usage limits, cost alerts, and data-processing/privacy notices are appropriate for the intended school and age group.
- [ ] Configure `LIVEAVATAR_API_KEY`, `LIVEAVATAR_AVATAR_ID`, and `LIVEAVATAR_CONTEXT_ID` (and `LIVEAVATAR_VOICE_ID` when required by the selected avatar) to enable the integrated LiveAvatar video path. The OpenAI Realtime model still handles English conversation; the avatar renders its spoken response as a synchronized animated video. Verify the provider account has Streaming Avatar access, avatar ID permission, usage budget, and required consent/privacy terms.
