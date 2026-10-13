# Courant

Courant is a calm, touch-friendly speaking and communication practice app built with Next.js, React, TypeScript and Tailwind CSS.

## Run locally

1. Install Node.js 22 LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Create a MongoDB Atlas cluster and database user; set `MONGODB_URI` and `MONGODB_DB=courant`.
5. Add an OpenAI API key to `OPENAI_API_KEY` to enable AI conversation, image understanding, audio transcription and spoken replies. The key stays on the server and must never be prefixed with `NEXT_PUBLIC_`.
6. Run `npm run dev` and open `http://localhost:3000`.

## AI learning room

- `/labs` — lesson/scenario library
- `/labs/[slug]` — responsive AI tutor room for conversation practice
- `POST /api/tutor` — conversational tutoring with optional image input
- `POST /api/tutor/transcribe` — converts recorded speech to text
- `POST /api/tutor/speech` — returns a spoken audio reply
- `POST /api/coach` — legacy heuristic demo feedback endpoint

The learning room uses an OpenAI chat model for age-appropriate conversational coaching, an audio transcription model to hear recorded answers, a speech model for spoken replies, and a vision-capable chat model to discuss images. iPad users can record audio through the browser's MediaRecorder API and use the image picker/camera when supported. HTTPS and user permission are required for microphone/camera access in deployed environments.

## Current limitations and responsible use

The live AI routes need a valid provider API key and have not been validated in production yet. API usage may incur provider charges. The prototype does not persist chat sessions or recordings to MongoDB. Sign-in and student/teacher dashboards remain demo screens; they are not authenticated or connected to saved student records. Browser/media support varies by iPadOS version. Obtain appropriate school/guardian consent before deploying for children, avoid collecting personal details, and implement retention/deletion controls and role-based access before a real classroom rollout.

## Production work remaining

Add secure authentication and role-based authorization, persist consented lesson progress in MongoDB, add provider rate limits and abuse protection, test supported iPadOS/Safari versions, add accessibility and privacy review, and verify deployment end to end.
