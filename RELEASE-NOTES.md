# Release v1.1.0 — 2026-11-21

Complete platform refresh. Download: `/mnt/agents/output/releases/lines-and-logos-v1.1.0.zip` (+ SHA256SUMS) — or clone `github.com/projectzerodays/lines-and-logos`.

## v1.1.0 adds (since v1.0.0)
- Full public-site redesign (8 pages, one design language) · customer portal v2 (auth + TOTP + passkeys + invoices/contracts/calendar/video) · partner dashboard rebuild · BYOK AI panel with local Hugging Face model hosting (live-tested) · Stripe checkout + signed webhooks · Google suite + Maps distance + video meetings · Kimi Claw console · governance (kill switches/audit/eval) · automation-gap suite (weekly memo, capacity, equipment, incidents, health scores, win/loss, market intel) · Tier-1 GTM spreadsheet · deploy kit (Docker, Compose prod, DigitalOcean, AWS, GCP, systemd, IONOS guide) · docs suite (wiki, control blueprint, GTM playbook, automation blueprint) · all audit-round fixes

## v1.0.0 — 2026-11-19
First complete packaging of the Lines & Logos Business OS.

## What's inside
- Zero-dependency Node server (`server.js`) — the entire back office: CRM/pipeline, quotes→invoices→payments, full ATS with resume uploads and candidate self-booking, field ops (dispatch, trips, per-diem), payroll/taxes/filings, vendor/dropship/inventory, corporate book + registered agent, affiliate commissions, AI agent workforce with governance (kill switches, audit trail, eval harness), BYOK AI provider panel (OpenRouter free default, 13 presets incl. local HF model hosting), persistent memory bank, spend audit + transaction Q&A, SEO audit engine, public marketing site with consent-gated analytics.
- Seeded with **25 real qualified prospects** (16 fully researched with named facilities contacts and verified provenance).
- Demo logins: `admin@linesandlogos.com / onepaint`, `crew@linesandlogos.com / onepaint`.

## Run it
- `node server.js` (or `start.sh` / `start.bat`) → http://localhost:3001
- Requires Node ≥ 18. No `npm install` needed.

## Honest limitations
- Email/SMS are simulated (logged, not sent) until Phase 3 provider wiring.
- Auth is demo-grade; Phase 3 hardening (hashed passwords, secrets) is the gate for real customer data.
- No compiled binaries: the "executable" is the zero-dependency Node server + launch scripts.

## Integrity
- No invented certifications, testimonials, prices, or results anywhere in the product.
- Mock data purged; `data/uploads/` empty at packaging.
