# Architecture

```
Browser (38 pages: public site + OS)  ──HTTPS──▶  server.js (Node ≥18, zero deps)
                                                    ├─ central gate: RBAC + PUBLIC_PATHS + rate limits
                                                    ├─ agents (31): heuristic cores + BYOK router
                                                    │    governance: master/per-agent kill → 423, audit, eval harness
                                                    ├─ integrations: Stripe · Google suite · video (Jitsi) ·
                                                    │    maps distance · local llama.cpp (LLAMA_HOME)
                                                    ├─ jobs: cron/daily → reminders, privacy sweep (30d),
                                                    │    spend audit, SEO audit, backups
                                                    └─ persistence: data/db.json (atomic), backups/ rotation
```

## Data flow highlights
- **Auth**: staff sessions (db tokens, scrypt passwords, per-IP login throttle, rotate-tokens); customer accounts (12-char passwords, TOTP RFC-6238, SMS, WebAuthn passkeys).
- **Customer portal v2**: `customer.html` + `assets/portal-views.js` — invoices/past-year downloads, deposits, disputes, contracts (download/sign), calendar (3-day modify window), AI interaction notes, alerts, per-OS app installs.
- **Public chat**: page-aware intents (walkthrough booking → followUp + event), SMS-consent gating, privacy replies, 30-day retention.
- **Honesty layer**: prospect records carry `verified{checks,missing,confidence,sources}`; no invented claims anywhere.
