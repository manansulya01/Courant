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

1. Install Node.js (LTS).
2. Clone this repository.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

## Database foundation

`supabase/schema.sql` contains the initial Supabase/Postgres schema for profiles and roles, organizations, classes, courses, units, lessons, scenarios, assignments, practice sessions, messages, skill scores and Creator Studio projects. It enables row-level security and includes starter policies.

To apply it, create a Supabase project and run the SQL in the Supabase SQL Editor. Review policies against your school's tenancy model before production use.

## Current limitations

- Login is a UI/demo flow, not production authentication.
- Speaking uses browser speech recognition and speech synthesis where supported. Browser support and microphone permission vary.
- The coach endpoint currently produces heuristic demo feedback from the transcript; it is not yet backed by an LLM or dedicated pronunciation model.
- Dashboard numbers and example learners are sample UI data, not database records.
- Audio is not uploaded or stored by the current browser practice flow.

## Production integration checklist

- Configure Supabase URL and anon key; implement server-verified sessions and role-aware route protection.
- Replace demo coach feedback with a server-side AI provider. Keep provider keys server-side.
- Use a dedicated speech/voice provider for robust transcription, streaming voice and pronunciation analysis.
- Persist sessions, transcripts and feedback in Postgres; add retention and consent controls before storing audio.
- Add end-to-end tests, accessibility checks, and production deployment configuration.
