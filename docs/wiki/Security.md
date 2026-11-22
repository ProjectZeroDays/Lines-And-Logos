# Security

## Posture (honest)
- ✅ Salted scrypt passwords (login-time upgrade), per-IP login throttle, security headers on every response (nosniff / DENY / CSP), token rotation route, masked API keys, per-key rate limits, signed Stripe webhooks (HMAC, 5-min tolerance), consent-gated comms, 30-day retention sweep, backups with restore drill path.
- ⚠️ Demo-grade elements remain: session tokens are db tokens (not JWT), demo logins documented, email/SMS simulated until providers wire in. Gate for real customer data: Postgres + migrations + backups, hashed sessions, HTTPS/HSTS, CSRF tokens.

## Disclosure
Security issues: **do not open public issues** — email info@linesandlogos.team with reproduction steps; acknowledgment within 24h.

## Hard rules
- No invented certifications/testimonials/results — ever.
- Keys live masked in `db.settings` or external env (see `.env.example`); never committed.
- Customer data: export + delete self-serve from Settings; disputes route to admin remediation.
