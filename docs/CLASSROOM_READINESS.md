# Courant release checklist

This checklist separates repository checks from launch tasks that require real credentials, a deployed environment, or physical devices. A green build is not a school-readiness certification.

## Eight workstreams

### 1. Build, lint, dependency and route checks
- [x] The existing GitHub `build-check` workflow blocks on high-severity production dependency advisories, reports development advisories non-blocking, and runs ESLint, security/input tests, a production Next.js build, and production route/security smoke tests on pushes and pull requests.
- [x] GitHub Actions starts the built production server and smoke-tests public routes, security headers, PWA assets, unauthenticated API boundaries, malformed/oversized requests, and fail-closed provider/rate-limit responses.
- [ ] Pin dependency versions and commit a package lockfile so local, CI, and Vercel installs are reproducible; the latest production and full-tree npm audits both report zero vulnerabilities.
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
- [x] The class-join SECURITY DEFINER RPC also requires that server-only credential, preventing authenticated clients from bypassing the API's per-IP join limit through direct RPC calls.
- [x] `/api/health` now performs a low-impact, fixed-identity call through the actual rate-limit RPC, verifying the stored hash matches the server secret without consuming a learner's tutor quota.
- [ ] Configure Supabase Auth redirect URLs and production SMTP; test signup confirmation and password recovery end-to-end.
- [ ] Run multi-account tests proving students and teachers cannot access another user's portfolio, class, submissions or progress by changing IDs.
- [ ] Import legacy MongoDB accounts and records if the old database becomes available; existing MongoDB credentials are not migrated automatically.
- [x] Recovered all 16 ordered Supabase migrations from the connected project's migration ledger and committed them under `supabase/migrations`.
- [ ] Replay all 16 migrations against a clean staging project; generate and configure a fresh server-only rate-limit/class-join secret, issue teacher invitation codes, and verify the full signup/classroom flow before production rollout.

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

Required server/deployment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `COURANT_RATE_LIMIT_SECRET` — exactly 64 characters; server-only, never prefix with `NEXT_PUBLIC_`
- `GEMINI_API_KEY` — server-only key for Gemini Live, tutoring, speech and transcription

Optional model selection:

- `GEMINI_LIVE_MODEL`
- `GEMINI_TEXT_MODEL`
- `GEMINI_TTS_MODEL`
- `GEMINI_TRANSCRIPTION_MODEL`

Optional streamed-avatar integration:

- `LIVEAVATAR_API_KEY`
- `LIVEAVATAR_AVATAR_ID`
- `LIVEAVATAR_CONTEXT_ID`
- `LIVEAVATAR_VOICE_ID`

Password recovery email is sent by Supabase Auth; configure a production SMTP provider and approved sender in the Supabase Auth settings. Teacher invitations are stored as hashes in `public.teacher_invites`; no plaintext invitation code belongs in an environment variable or Git.

### Rate-limit secret setup for a new environment

1. Generate a fresh 32-byte random value in a secure terminal, for example with `openssl rand -hex 32`.
2. Set that exact value as `COURANT_RATE_LIMIT_SECRET` in the server's secret manager.
3. In the target Supabase project's SQL editor, store only its SHA-256 hash:

```sql
insert into public.api_internal_secrets(name, secret_hash)
values ('rate_limit_rpc', encode(extensions.digest('<PASTE_SECRET_HERE>', 'sha256'), 'hex'))
on conflict (name) do update set secret_hash = excluded.secret_hash;
```

4. Confirm `GET /api/health` returns HTTP 200 and reports `rateLimitRpc: "ok"`. Never commit the generated value or paste it into a client-side variable.

The current application no longer requires `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`, `OPENAI_API_KEY`, or Resend credentials. Keep old secrets only during a deliberate rollback window, then rotate/remove them. Legacy MongoDB account/data migration remains a separate task if an export is available. The automated suite uses isolated placeholder credentials; its expected 503/401 responses verify safe failure behavior, not live provider availability.

## Live AI teacher capability boundary

The hosted call uses Gemini Live over a WebSocket for low-latency spoken conversation, learner-level adaptation, live transcription, and an optional post-call recap. In video mode, the learner can enable the camera; the browser sends compressed JPEG still frames (480 pixels wide, approximately every 1.1 seconds) to Gemini as visual context. This is periodic image sharing, not a continuous video stream, and the camera can be paused independently.

The teacher display uses a local animated SVG avatar by default. Its simple mouth animation follows generated response transcription; it is not a photorealistic avatar or precise audio lip-sync. If LiveAvatar credentials and an eligible account are configured, the room can upgrade to a streamed avatar. If that provider is missing or unavailable, the local avatar and Gemini voice call continue. The separate `/local-tutor` runs a small WebLLM model on compatible WebGPU devices; its camera is a private self-preview and is not analysed by that local model. Browser speech recognition may use its own online service, while spoken replies use installed system voices.

The app does not automatically persist live transcripts or raw audio recordings. A recap is generated only when requested and remains on the page unless the learner explicitly saves related progress.

### Required release verification

- [ ] Replay all 16 migrations in a clean staging Supabase project and configure a fresh RPC secret as described above.
- [ ] Configure `GEMINI_API_KEY`; verify `/api/health`, a live voice session, text tutoring, TTS, and transcription using non-sensitive test accounts.
- [ ] Configure Supabase Auth SMTP, site URL, and redirect URLs; test confirmation and password recovery email delivery.
- [ ] Create a teacher invitation through a secure admin process; verify teacher signup, student signup, class creation, class joining, assignments, submission and review.
- [ ] Test voice call, mute, interruption, end-call cleanup, camera pause/resume, and recap generation on physical iPadOS/Safari and desktop browsers.
- [ ] If streamed avatar video is required, configure LiveAvatar credentials and verify provider access, avatar permissions, usage budget, consent and privacy terms. Otherwise the local animated avatar is the supported fallback.
- [ ] Confirm provider usage limits, cost alerts, data-processing/privacy notices, age-appropriate consent and school/guardian review before enrolling real students.
