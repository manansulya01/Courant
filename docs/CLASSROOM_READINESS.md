# Courant release checklist

This checklist separates repository checks from launch tasks that require real credentials, a deployed environment, or physical devices. A green build is not a school-readiness certification.

## Eight workstreams

### 1. Build, lint, dependency and route checks
- [x] CI blocks on high-severity production dependency vulnerabilities and separately reports full-tree findings. The full-tree report currently includes an unpatched development-tooling advisory for braces (GHSA-vfj7-8cjw-p6xm); it is report-only because no fixed release is published and the production-only audit remains blocking. CI also runs ESLint, security unit tests, production build, and production smoke tests.
- [x] Smoke checks cover key public routes, security headers, expected auth boundaries, unavailable-provider responses, malformed/oversized coaching requests, and oversized streamed bodies without `Content-Length`.
- [x] Learner JSON APIs use a shared streaming byte limit instead of trusting `Content-Length` or buffering unbounded request bodies.
- [x] Node test suite covers valid objects, malformed JSON, non-object JSON, declared-size rejection, and streamed oversized bodies.
- [x] Teacher write/delete handlers apply rate limits before bounded streaming JSON parsing; classroom cascades run in a MongoDB transaction.
- [ ] Commit a lockfile and move CI to `npm ci` after dependency versions are intentionally pinned.
- [ ] Add unit/integration tests with a disposable replica-set MongoDB instance and mocked provider responses; verify transaction rollback and tenant isolation.

### 2. Authentication, authorization and tenant isolation
- [x] Protected API routes return unauthenticated responses in production smoke tests.
- [ ] Configure a production-strength `AUTH_SECRET`; verify session expiry, rotation, secure cookie flags and password recovery email.
- [ ] Run multi-account tests proving students and teachers cannot access another user's portfolio, class, submissions or progress by changing IDs.
- [ ] Confirm teacher registration/invitation flow with school administrators.

### 3. AI conversation and speech reliability
- [x] English conversation page supports push-to-talk, transcription, spoken replies, replay and text/browser speech fallback.
- [x] AI endpoints bound request sizes, validate image/audio inputs, avoid caching learner responses and time out upstream provider calls.
- [ ] Configure and cap AI provider spend; test provider 401/429/5xx, timeout, offline, interrupted recording and retry flows.
- [ ] Verify voice quality, latency, pronunciation-feedback claims and speech support on actual target iPads.

### 4. Database resilience and privacy
- [x] MongoDB client pool and server selection timeout are configured; health endpoint reports database/auth readiness without exposing credentials.
- [ ] Use a least-privilege database user, TLS, IP/network restrictions, backups, monitoring and a documented tested restore procedure.
- [ ] Confirm indexes, migrations, retention/TTL policies and account deletion across all related collections.
- [ ] Verify transcripts/raw recordings are not retained unless explicitly designed, consented to and documented.

### 5. Web/API security and operational controls
- [x] Baseline response headers include frame denial, MIME sniffing protection, referrer policy and restrictive camera/microphone/geolocation permissions; HSTS is production-only.
- [x] High-cost tutoring and coaching endpoints use same-origin checks and rate limiting.
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

## Required environment configuration

- `MONGODB_URI`, `MONGODB_DB`
- `AUTH_SECRET` (random, at least 32 characters)
- `OPENAI_API_KEY` and optionally `OPENAI_MODEL`, `OPENAI_TTS_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL` for password recovery email
- `COURANT_TEACHER_INVITE_CODE` if teacher invitation gating is enabled

Never commit these values or expose them through `NEXT_PUBLIC_*`. Configure them in the deployment provider's secret manager. The automated suite intentionally runs without production credentials; its expected 503/401 responses are checks of safe failure behavior, not proof that live integrations work.


## Live AI teacher capability boundary

The live coach supports real-time spoken conversation through WebRTC, learner-level adaptation, live transcription in the page, and an optional post-call learning recap. Video mode captures a local camera preview and sends a compressed still frame roughly every six seconds as visual context; it does **not** stream continuous video to the model or generate a live human teacher video. Camera permission is requested by the browser and can be paused independently during the call. The recap is generated only when the learner asks for it and remains in the page; the live transcript is not automatically persisted.

### Required release verification

- [ ] Configure a server-side `OPENAI_API_KEY` with Realtime API access and verify `/api/tutor/realtime-session` returns a short-lived client secret.
- [ ] Configure MongoDB Atlas, `AUTH_SECRET`, and production HTTPS.
- [ ] Test voice call, mute, interruption, end-call cleanup, camera pause/resume, and recap generation on physical iPadOS/Safari and desktop browsers.
- [ ] Confirm that provider usage limits, cost alerts, and data-processing/privacy notices are appropriate for the intended school and age group.
- [ ] Configure `HEYGEN_API_KEY` and `HEYGEN_AVATAR_ID` to enable the integrated HeyGen Streaming Avatar video path. The OpenAI Realtime model still handles English conversation; the avatar renders its spoken response as a synchronized animated video. Verify the provider account has Streaming Avatar access, avatar ID permission, usage budget, and required consent/privacy terms.
