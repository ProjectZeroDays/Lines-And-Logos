# API Reference

Base `/api` · errors: `{ code, message, details, requestId }` · every `/api/agent/*` POST is governance-gated.

| Family | Selected endpoints | Auth |
| --- | --- | --- |
| Auth (staff) | `POST /api/login`, `POST /api/forgot`, `POST /api/reset`, `POST /api/rotate-tokens` | public/mixed |
| Auth (customers) | `POST /api/auth/register`, `/login`, `/2fa`, `totp/setup`, `totp/enable`, `passkey/*` | public |
| Account | `GET/PUT/DELETE /api/account`, `/photo`, `/job-photo`, `/photos`, `/dispute`, `/modify-request`, `/export`, `/alerts`, `/notes`, `/invoices`, `invoice-download` | customer session |
| CRM | `GET/POST/PATCH /api/leads`, `/api/prospects`, `/api/referrals` | staff |
| Money | `POST /api/quote-request`, `/api/stripe/checkout`, `webhook`, `GET /api/spend-audit` | mixed |
| AI | `/api/ai/providers*` (BYOK), `/routing`, `/usage`, `/assist`, `/local/*` | staff |
| Governance | `/api/agent-governance`, `/agent-audits`, `POST /api/agent/eval` | staff |
| Ops | `/api/maps/distance`, `POST /api/video/meeting`, `/api/google`, `/api/gworkspace`, `/api/corporate*`, `/api/dropship-orders`, `GET /api/seo/audit` | staff/public |
| Claw | `/api/claw`, `/claw/config`, `/claw/run`, `/claw/schedule` | staff |
| Public | `/api/chat-public`, `/api/apply`, `/api/candidate*`, `/api/careers/*`, `/api/blog`, `/api/reviews` | public |

**Rule:** any new public endpoint must be added to `PUBLIC_PATHS` in the central gate (exact-path match) or anonymous requests 403/401.
