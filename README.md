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
8. Run `npm run dev` and open `http://localhost:3000`.

## Main experiences

- `/labs` and `/labs/[slug]` — scenario library and AI practice room
- `/practice-plan` — configurable practice plan
- `/signup` and `/login` — account creation and sign-in
- `/dashboard` — learner progress, class membership, assignments, and saved sessions
- `/teacher` — teacher-only class and assignment management
- `/creator` — private learner portfolio editor
- `POST /api/tutor` — conversational tutoring with optional image input and recent saved learning context
- `POST /api/tutor/transcribe` — converts recorded speech to text
- `POST /api/tutor/speech` — returns a spoken audio reply
- `/api/learning/progress` — save/read authenticated learner progress
- `/api/portfolio` — authenticated portfolio CRUD
- `/api/teacher` — teacher/admin class and assignment management
- `/api/classes/join` — join a class with its teacher-issued code
- `/api/assignments` — list assignments for classes a learner belongs to

The application uses MongoDB collections for users, learning progress, classes, assignments, and portfolio items. Passwords are hashed using Node.js scrypt; sessions use signed, HttpOnly cookies. The app does not save chat transcripts or raw audio recordings; learners can explicitly save lesson metadata to their journal.

## Before production or school rollout

This repository includes working implementation foundations, but passing a code commit or CI build is not a substitute for security review or a deployed end-to-end test. Configure MongoDB, `AUTH_SECRET`, teacher invitations, and the OpenAI key before trying account or AI flows. Browser media support varies by iPadOS/Safari version; microphone/camera access requires user permission and HTTPS in production.

Before enrolling real students, add and test rate limiting and abuse controls, password reset and account recovery, verified email, account deletion and data export, retention/deletion policies, CSRF/origin protections for state-changing routes, teacher/student membership and assignment-submission workflows, monitoring/backups, and a privacy/accessibility/child-safety review appropriate to the jurisdictions and schools involved. AI feedback should not be presented as a validated pronunciation or educational assessment unless separately validated.
