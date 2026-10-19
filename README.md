# Courant

Courant is a calm, touch-friendly speaking and communication practice app built with Next.js, React, TypeScript, Tailwind CSS, and MongoDB.

## Run locally

1. Install Node.js 22 LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Create a MongoDB Atlas cluster and database user; set `MONGODB_URI` and `MONGODB_DB=courant`.
5. Set `AUTH_SECRET` to a cryptographically random value at least 32 characters long. Do not commit real secrets.
6. Optionally set `COURANT_TEACHER_INVITE_CODE`; teacher registration requires this invitation code.
7. Add an OpenAI API key to `OPENAI_API_KEY` to enable AI conversation, image understanding, audio transcription, and spoken replies. Keep it server-side; never prefix it with `NEXT_PUBLIC_`.
8. For live voice/video calls, ensure the OpenAI project has Realtime API access. Optional settings: `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_TRANSCRIPTION_MODEL`, and `OPENAI_REALTIME_VOICE`. The app issues short-lived client secrets from a same-origin, rate-limited server route; the permanent API key never reaches the browser.
9. To show a continuously animated AI teacher during video calls, configure `HEYGEN_API_KEY` and `HEYGEN_AVATAR_ID` using a HeyGen Streaming Avatar enabled for your account. The API key stays server-side; a short-lived token is issued to the browser.
10. Run `npm run dev` and open `http://localhost:3000`.

## Main experiences

- `/labs` and `/labs/[slug]` — scenario library and AI practice room
- `/talk` — open-ended spoken English conversation with push-to-talk, transcription, natural spoken replies, replay, and text fallback
- `/live-call` — real-time English voice practice and, when HeyGen is configured, an animated streaming AI teacher with live spoken responses, camera preview, beginner/intermediate/advanced coaching, and optional post-call feedback
- `/practice-plan` — configurable practice plan
- `/signup` and `/login` — account creation and sign-in
- `/dashboard` — learner progress, class membership, assignments, and saved sessions
- `/teacher` — teacher-only class and assignment management
- `/creator` — private learner portfolio editor
- `/forgot-password` and `/reset-password` — one-time password recovery (requires Resend configuration)
- `/settings` — personal data export and account deletion
- `/teacher/review` — teacher feedback and optional scoring for submitted work
- `POST /api/tutor` — conversational tutoring with optional image input and recent saved learning context
- `POST /api/tutor/transcribe` — converts recorded speech to text
- `POST /api/tutor/speech` — returns a spoken audio reply
- `POST /api/tutor/realtime-session` — issues a short-lived Realtime API client secret for WebRTC calls
- `GET /api/health` — reports database readiness and whether server-side AI/auth configuration is present
- `/api/learning/progress` — save/read authenticated learner progress
- `/api/portfolio` — authenticated portfolio CRUD
- `/api/teacher` — teacher/admin class and assignment management
- `/api/classes/join` — join a class with its teacher-issued code (new classes use 8-character codes; existing 4-character codes remain valid)
- `/api/assignments` — list assignments for classes a learner belongs to
- `/api/assignments/submissions` — student submissions and teacher review
- `/api/account` — export personal data or delete an account and associated records

The application uses MongoDB collections for users, learning progress, classes, assignments, assignment submissions, rate limits, and portfolio items. Passwords are hashed using Node.js scrypt; sessions use signed, HttpOnly cookies. The app does not save chat transcripts or raw audio recordings; learners can explicitly save lesson metadata to their journal. In the turn-based practice room, learners can speak through push-to-talk recording, review the transcription before sending it, hear natural spoken replies, and replay the latest reply. Live calls use WebRTC for low-latency speech and return spoken corrections during the conversation. When HeyGen Streaming Avatar is configured, video mode renders the AI teacher as a live animated video stream; the learner's own camera remains optional and visual snapshots sent to the language model are separate. Without HeyGen configuration, live voice remains available but animated teacher video is unavailable. Camera/microphone access requires explicit browser permission and HTTPS in production. A browser speech-synthesis fallback may be used if the configured voice service is unavailable.

## Before production or school rollout

This repository includes working implementation foundations, but passing a code commit or CI build is not a substitute for security review or a deployed end-to-end test. Configure MongoDB, `AUTH_SECRET`, teacher invitations, and the OpenAI key before trying account or AI flows. Browser media support varies by iPadOS/Safari version; microphone/camera access requires user permission and HTTPS in production.

State-changing API routes check request origin, and high-cost/authenticated write endpoints use MongoDB-backed rate-limit buckets. JSON APIs that accept learner text, feedback, progress, or account actions enforce byte limits while streaming request bodies, including requests without a trustworthy `Content-Length`. Baseline browser security headers are applied by the Next.js proxy entry point. The rate limiter depends on MongoDB being available and should be validated behind the actual production proxy before launch.

Still required before enrolling real students: configure and verify production email and AI providers; run authenticated integration tests against a staging MongoDB deployment; test password recovery, account export/deletion, role/class isolation, and backup restoration end to end; configure monitoring and incident response; test microphone/camera permissions and audio playback on supported iPadOS/Safari versions; and complete privacy, accessibility, child-safety, and jurisdiction-specific legal review. Do not treat heuristic feedback scores as validated educational or pronunciation assessments. AI feedback should not be presented as a validated pronunciation or educational assessment unless separately validated.


### Password recovery email

Password recovery is enabled when `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a verified sender in Resend), and `APP_URL` (the canonical HTTPS application origin in production) are configured. Reset links expire after 30 minutes and are single-use. Without email configuration, the request endpoint intentionally responds with a generic message and does not send a link.
