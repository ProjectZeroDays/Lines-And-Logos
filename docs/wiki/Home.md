# Lines & Logos Business OS — Wiki

Engineering knowledge base for the Business OS (`server.js`, port 3001, zero dependencies).

## Pages
| Page | Contents |
| --- | --- |
| [Architecture](Architecture.md) | System layout, data flow, the 256-route surface, persistence model |
| [API Reference](API-Reference.md) | Endpoint families, auth model, public allowlist, error envelope |
| [Security](Security.md) | Current posture, Phase-3 hardening, disclosure path |

## Quick orientation
- `server.js` — the entire backend (4,600+ LOC): routes, agents, auth gate, integrations.
- `assets/os.js` — OS runtime (store + API client + offline demo mode); `assets/os.css` — Argon-style light theme.
- `data/db.json` — all state (atomic saves, `data/backups/` rotation, `data/uploads/` resumes/job photos).
- Public chat: `assets/chat.js` (docked bar, page-aware, walkthrough booking). Admin: 17 tabs incl. AI Providers (BYOK), Governance, Memory, Kimi Claw.

## Rules
- Never invent certifications, testimonials, prices, or results — verify or mark pending.
- New public POST routes must join `PUBLIC_PATHS` in the central gate or they 403 anonymously.
- Every `/api/agent/*` call is governance-gated (kill switches) and audited.
