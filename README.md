# Courant

Courant is a speaking-practice and communication-coaching app built with Next.js, React, TypeScript and Tailwind CSS. Its visual direction is intentionally quiet and editorial: warm neutrals, deep botanical green, generous spacing and accessible controls.

## Local setup

1. Install Node.js 22 LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Create a MongoDB Atlas cluster and database user.
5. Allow your development IP in Atlas Network Access, then copy the driver connection string into `MONGODB_URI`. Replace the placeholders and URL-encode special characters in the password.
6. Set `MONGODB_DB=courant`.
7. Run `npm run dev` and open `http://localhost:3000`.

Never commit `.env.local` or expose `MONGODB_URI` to browser code. Import `lib/mongodb.ts` only from server code.

## Routes

- `/` — public site
- `/login` — demo sign-in screen, not authenticated
- `/dashboard` — student dashboard with sample data
- `/labs` and `/labs/[slug]` — scenario library and speaking room
- `/teacher` — teacher workspace with sample data
- `/creator` — Creator Studio UI
- `/api/coach` — heuristic demo feedback endpoint

## Current limitations

Sign-in does not authenticate users. Dashboard and teacher metrics, recordings and creator projects are illustrative data. The MongoDB connection helper exists, but current UI flows are not yet persisting data. Speech recognition and synthesis depend on browser support. Coach feedback is heuristic, not AI-generated or validated pronunciation analysis. The school enquiry form does not send information. Audio is not stored.

## Production work remaining

Implement secure authentication and role-aware authorization; persist sessions, transcripts, scores, classes, assignments and projects in MongoDB; integrate an AI coach and reliable speech provider; add privacy, consent, retention and deletion controls; and complete automated tests, accessibility checks and deployment verification.