# Courant — deployment and classroom-readiness checklist

This checklist is deliberately explicit: a green build does not mean a safe classroom launch.

## Automated checks (repository)
- [ ] Install dependencies from a committed lockfile using `npm ci`.
- [ ] Run dependency audit, lint, production build and production smoke tests in CI.
- [ ] Add automated unit/integration tests for validation, provider failures, timeout behavior and authorization.
- [ ] Add visual regression and keyboard/accessibility checks for the core student and teacher flows.

## Identity and access
- [ ] Select an identity provider and document account lifecycle, recovery and session expiry.
- [ ] Require authentication for student and teacher workspaces.
- [ ] Enforce roles and tenant/class ownership on the server for every read and write.
- [ ] Add CSRF protections where cookie-based mutations require them, secure cookie flags, and session rotation.
- [ ] Verify that one learner or teacher cannot access another person's records by changing identifiers.

## Student privacy and safety
- [ ] Complete a child/student privacy impact review with the school/guardian stakeholders.
- [ ] Collect only the minimum data necessary; never request sensitive personal information in prompts.
- [ ] Obtain and record appropriate consent before recording audio, using images, or saving progress.
- [ ] Publish retention, export, correction and deletion processes and test them.
- [ ] Decide whether recordings/transcripts are stored at all; default to not retaining raw media.
- [ ] Review AI prompts, content safety, escalation language and teacher oversight for the learner age group.

## MongoDB and API security
- [ ] Use a least-privilege database user, TLS, IP/network restrictions, backups and tested restores.
- [ ] Add schema validation, indexes, data lifecycle/TTL policies where appropriate and migrations.
- [ ] Add distributed rate limiting, request-size limits, abuse monitoring and spend caps.
- [ ] Keep secrets server-only and rotate any exposed credentials immediately.
- [ ] Add structured, privacy-preserving logs and error monitoring without transcript/media leakage.

## Device and release verification
- [ ] Test current supported iPadOS/Safari versions on real devices.
- [ ] Test microphone/camera permission grants and denials, interrupted recordings, offline/reconnect and long sessions.
- [ ] Verify touch targets, screen readers, keyboard navigation, contrast, zoom and reduced motion.
- [ ] Configure production domain, HTTPS, CSP appropriate to the deployment, environment secrets, health checks and alerts.
- [ ] Run a limited pilot with non-sensitive test accounts and an explicit rollback plan.
- [ ] Obtain school/security/privacy sign-off before enabling real student accounts.
