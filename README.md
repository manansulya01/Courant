# Courant

Courant is a speaking-practice and communication-coaching app built with Next.js, React, TypeScript and Tailwind CSS.

## Current app routes

- `/` — public marketing site
- `/login` — demo sign-in UI
- `/dashboard` — student dashboard
- `/labs` — scenario library
- `/labs/confident-introduction` — speaking practice room
- `/teacher` — teacher workspace
- `/creator` — Creator Studio
- `/api/coach` — demo feedback endpoint

## Run locally

1. Install Node.js LTS.
2. Clone this repository and run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Create a free MongoDB Atlas cluster and create a database user.
5. In Atlas, allow your development IP under Network Access, then choose **Connect → Drivers** and copy the connection string into `MONGODB_URI`. Replace the username/password placeholders; URL-encode special characters in the password.
6. Set `MONGODB_DB=courant` (or another database name).
7. Run `npm run dev` and open `http://localhost:3000`.

Do not commit `.env.local`, and never expose `MONGODB_URI` in client-side code. The database utility in `lib/mongodb.ts` is server-only by convention: import it only from route handlers or server components.

## Database

Courant now uses MongoDB Atlas as its database foundation. The app can connect through `getDatabase()` in `lib/mongodb.ts`. Suggested collections are `users`, `classes`, `assignments`, `scenarios`, `practiceSessions`, `sessionMessages`, `skillScores` and `creatorProjects`. MongoDB creates collections when first written, so a separate SQL schema is not required.

## Current limitations

- Login is a UI/demo flow, not production authentication.
- Speaking uses browser speech recognition and speech synthesis where supported. Browser support and microphone permission vary.
- The coach endpoint currently produces heuristic demo feedback from the transcript; it is not yet backed by an LLM or dedicated pronunciation model.
- Dashboard numbers and example learners are sample UI data, not database records.
- The MongoDB connection helper is in place, but the app's current screens and practice flow are not yet persisting data.
- Audio is not uploaded or stored by the current browser practice flow.

## Remaining production work

- Implement secure authentication (for example, Auth.js with a MongoDB adapter, or another server-verified auth solution) and enforce role-aware access on every protected route and API.
- Connect session history, transcripts, scores, assignments, classes and Creator Studio projects to MongoDB.
- Replace demo coach feedback with a server-side AI provider; keep provider keys server-side.
- Use a dedicated speech/voice provider for robust transcription, streaming voice and pronunciation analysis.
- Add retention and consent controls before storing audio.
- Add end-to-end tests, accessibility checks, and production deployment configuration.
