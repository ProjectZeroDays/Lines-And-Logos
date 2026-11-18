# Lines & Logos — Full Project Handover (Session Thread)

> **Handover document for Kimi (or any successor agent).**  
> Summarizes the full build, integration, debugging, and deployment work performed across this session so the project can be continued or rebuilt end-to-end.  
> Generated: Wed Nov 18 2026 · Repo: `https://github.com/ProjectZeroDays/Lines-And-Logos` (branch `master`)

---

## 1. Objective

Build a **fully automated, tested-and-working Business OS** for **Lines & Logos** — a Memphis, TN facility branding & athletic surface company (gym floors, court restripes, wall wraps, donor walls, signage, athletic surfacing, parking lots, playgrounds) — and then:

- Merge the separate `employee-onboarding` app into the single `business-os` app.
- Push to GitHub, ship a local-dev `.exe` launcher attached to a release.
- Run `npm run db:seed`, then test-and-debug in a loop until **all errors and bugs are gone**.
- Combine the Business OS with the separate **autonomous dropshipping bridge** into **one unified dashboard** with an **app landing page**.

---

## 2. Key Decisions

| Decision | Value |
|---|---|
| Single app | `business-os/` is the only app; `employee-onboarding/` retained but deprecated/merged (README marks it reference-only) |
| Package manager | **pnpm** (npm/yarn installs hang on slow/flaky network; `pnpm-lock.yaml` committed) |
| Dev port | **3001** (`npm run dev` → `next dev -p 3001`; `.env` baseURL uses 3001) |
| Database (dev) | Prisma + SQLite (`prisma/dev.db`, git-ignored); PostgreSQL swap documented for prod |
| Launcher | PyInstaller `LinesAndLogos-Launcher.exe` (~10 MB) at repo root, attached to release `v1.0.0` |
| Dropshipping bridge | Express + React (Vite) app on port 3000; Business OS becomes the unified host via Next.js rewrites under `/bridge/*` |
| License | MIT (designated; `LICENSE` file still pending — see Roadmap) |
| Author | Trey A. Smith · Authenticated, Inc. · GitHub @ProjectZeroDays |

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                             │
│   Next.js 15.5.29 · App Router · React Server Components             │
│   59 pages (dashboard, sales, ops, finance, HR, marketing, admin)     │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ RSC / fetch
┌───────────────────────────────▼──────────────────────────────────────┐
│                       APPLICATION LAYER                               │
│  Route handlers (24 JSON routes)  ·  AI Agents (9)  ·  Cron (daily/weekly) │
└───────────┬─────────────────────┬───────────────────────┬────────────┘
            │                     │                       │
┌───────────▼─────────────────────▼───────────────────────▼────────────┐
│                       DATA LAYER                                       │
│   Prisma ORM 5.22  ·  35 models  ·  SQLite (dev) / PostgreSQL (prod)  │
└───────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│  EXTERNAL (optional): Resend/SMTP · Twilio SMS · Stripe · OpenAI/Anthropic │
│  Dropshipping bridge (port 3000) proxied under /bridge/* via rewrites  │
└──────────────────────────────────────────────────────────────────────┘
```

### Unified Dashboard (final architecture)
- **Business OS** (Next.js, port 3001) is the single host / dashboard.
- **Dropshipping bridge** (Express + React/Vite, port 3000) stays the data source.
- Next.js rewrites `/bridge/*` → `http://localhost:3000/*` (single origin, no CORS).
- `/dropshipping` page aggregates bridge data (orders, agents, config, sync status) server-side.
- `/` is a real landing page (no longer just a redirect to `/dashboard`).

---

## 4. Repository Layout (annotated)

```
Lines & Logos/
├── business-os/                          # Next.js app (primary source)
│   ├── prisma/
│   │   ├── schema.prisma                 # 35 models, relations & indexes
│   │   └── seed.ts                       # Idempotent sample-data seed
│   ├── src/
│   │   ├── app/                          # 59 page.tsx + 24 route.ts
│   │   │   ├── (dashboard pages…)
│   │   │   ├── dropshipping/page.tsx     # NEW unified bridge view
│   │   │   └── api/                      # REST/JSON handlers
│   │   ├── lib/                          # db, ai-agents, email, sms, pdf, utils
│   │   └── components/                   # Sidebar, forms, charts, portals
│   ├── next.config.js                    # NEW rewrites + workspace root
│   ├── pnpm-workspace.yaml               # NEW postcss override
│   ├── .env.example                      # All config keys
│   └── package.json                      # scripts: dev/build/start/db:*
├── LinesAndLogos-Launcher.exe            # Dev launcher (v1.0.0, PyInstaller)
├── launcher.py / *.spec                  # Launcher sources
├── logo*.png                             # Brand assets
├── Memphis_*Prospecting*.xlsx            # Tier 1/2/3 prospect databases
├── Tier1_Computed_Scores.csv             # Computed fit/budget/tier scores (30 accounts)
├── Proposal_*.md / .xlsx                 # Proposal suite + calculator
├── Pricing_Calculator.xlsx
├── Summer_Install_Calendar.xlsx
├── Business_Automation_Blueprint.md      # 63 ranked automations (~$115k/yr)
├── Business_Plan_Outline.md
├── 90_Day_Launch_Plan.md
├── Outreach_*.md                         # Outreach sequences + MSCS/DeSoto variants
├── Competitive_Battle_Card.md
├── README_Deliverables.md                # Index of every deliverable
├── employee-onboarding/                  # MERGED (deprecated, reference-only)
└── .gitignore                            # node_modules, .next, *.db, .env*, *.exe
```

> `build/`, `dist/`, `repo/` are local build artifacts (not tracked).

---

## 5. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5.29 (App Router, RSC, route handlers) |
| UI | React 19.3.1, TypeScript 5.9.x |
| ORM / DB | Prisma 5.22.0 · SQLite (dev) / PostgreSQL (prod) |
| Validation | zod (removed from business-os — unused; kept removed) |
| Package mgr | pnpm 12.16.1 |
| AI | Heuristic agents (default, free) + optional OpenAI/Anthropic |
| Comms | Resend/SMTP email, Twilio SMS |
| Payments | Stripe (scaffold) |
| Dev port | 3001 |

---

## 6. Feature Inventory

### Sales & Pipeline
Leads (AI scoring 0–100 → hot/warm/cold), Accounts (health green/yellow/red), Quotes & pipeline, Contacts.

### Operations
Jobs (lead → quoted → in-progress → complete), Schedule, Time tracking, Checklists + runs.

### Finance
Invoices (draft→sent→overdue→paid, overdue detection), Expenses/Revenue, escalating reminders (friendly/firm/final), Payments.

### Team & HR
Employees & 1099 contractors, recruiting pipeline, scorecards, vendors & POs. **1099 onboarding flow:** apply → AI screen → approve → 5 documents + portal token → e-sign (W-9, 1099 ack, scope, safety, offer) → dispatchable.

### Marketing
Content queue (AI-repurposed), campaigns, landing pages, social calendar.

### Admin
Wiki/SOPs, policies, approvals, reports, settings, client portal, support, feedback.

### AI Agents (9)
Lead Score, Job Dispatch, Invoice Reminder, Health Score, Competitor Watch, Daily Ops, Job Status Update, Content Repurposing, Competitor Analysis. All run without any API key (heuristics); upgrade to LLM automatically when keys present.

### Cron
- `GET /api/cron/daily` — ops brief, overdue invoice reminders, task-overdue check, account health.
- `GET /api/cron/weekly` — weekly report email, competitor watch, market scan, content planning.

---

## 7. Installation

### Prerequisites
Node.js ≥ 18, npm ≥ 9 (or pnpm), Git. ~800 MB disk. Windows/macOS/Linux.

### Quick start
```bash
git clone https://github.com/ProjectZeroDays/Lines-And-Logos.git
cd Lines-And-Logos/business-os

npm install                 # or: pnpm install
cp .env.example .env.local  # Windows: copy .env.example .env.local
npx prisma db push          # creates prisma/dev.db + client
npm run db:seed             # idempotent; safe to re-run
npm run dev                 # http://localhost:3001
```

Open `http://localhost:3001`. You should see seeded demo data (MSCS, DeSoto, Bellevue Baptist).

### First-run verification
```bash
curl http://localhost:3001/api/leads
# → 200 [{"id":"…","name":"Dr. Roderick Richmond",…}]

curl -X POST http://localhost:3001/api/apply -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","phone":"901-555-1234","position":"Floor Installer","experience":"3","skills":"hardwood","availability":"full-time","hasTransport":true,"hasInsurance":true,"coverLetter":"3 years hardwood installation.","references":"John Smith, 901-555-9999"}'
# → {"applicantId":"…","aiScore":85,"recommendation":"strong",…}
```

### Run both apps together (unified dashboard)
```bash
# Terminal 1 — dropshipping bridge (data source)
cd C:\Projects\autonomous-dropshipping-shopify-taskade-app
npm start            # http://localhost:3000

# Terminal 2 — unified dashboard
cd "C:\Users\Project Zero\Desktop\Lines & Logos\business-os"
npm start            # http://localhost:3001  (landing at /, bridge at /dropshipping)
```

---

## 8. Configuration

All config in `.env.local` (git-ignored). Every integration optional; app runs offline with zero keys.

| Key | Purpose |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | Absolute links (portal, emails) |
| `ADMIN_EMAIL` | Admin notifications |
| `CRON_SECRET` | **Protects cron routes** — required outside localhost |
| `RESEND_API_KEY` / `FROM_EMAIL` | Email via Resend |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP fallback |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | SMS |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AI agents (OpenAI path) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | AI agents (Anthropic path) |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments |
| `DATABASE_URL` | PostgreSQL swap (prod) |

When keys are absent: email/SMS log to stdout and mark `Notification` as sent (simulated); agents use heuristics; Stripe returns scaffolds.

**Security:** never commit `.env*` (already git-ignored).

---

## 9. CLI Reference

| Command | Output (real) |
|---|---|
| `npm run dev` | `✓ Ready in 22–135s` |
| `npm run build` | `✓ Compiled successfully` + type checks |
| `npm start` | `next start -p 3001` |
| `npm run db:push` | `Your database is now in sync` |
| `npm run db:seed` | `Seeded Business OS with sample data` (idempotent) |
| `npm run db:studio` | `http://localhost:5555` |
| `npx prisma generate` | `✔ Generated Prisma Client (v5.22.0)` |
| `npx tsx prisma/seed.ts` | Same as db:seed |

---

## 10. API Endpoints (24 handlers)

### Sales & Pipeline
`GET/POST /api/leads`, `/api/accounts`, `/api/contacts`, `/api/quotes`

### Operations
`GET/POST /api/jobs`, `/api/time-entries`, `/api/checklists`

### Finance
`GET/POST /api/invoices`, `/api/expenses`, `/api/revenue`

### Team & HR
`GET/POST /api/employees`, `/api/candidates`, `/api/vendors`
`POST /api/apply` — public intake (AI-scored)
`POST /api/admin/applicants/[id]/approve` — creates employee + 5 docs + portal token
`POST /api/admin/applicants/[id]/reject`
`GET /api/portal/[token]` — contractor portal payload
`POST /api/portal/[token]/sign` — body `{"signature":"Name"}`

### Marketing
`GET/POST /api/campaigns`, `/api/content`

### Admin & Knowledge
`GET /api/wiki`, `/api/policies`

### Cron
`GET /api/cron/daily`, `GET /api/cron/weekly` — protected by `Bearer $CRON_SECRET`

Example:
```bash
curl http://localhost:3001/api/leads
# → 200 [{"id":"…","name":"Dr. Roderick Richmond","company":"Memphis-Shelby County Schools",…}]
```

---

## 11. Configuration Examples

### `.env.local` (minimal, offline)
```env
NEXT_PUBLIC_BASE_URL=http://localhost:3001
ADMIN_EMAIL=admin@linesandlogos.com
CRON_SECRET=generate-a-long-random-string
```

### Cron (GitHub Actions)
```yaml
on:
  schedule:
    - cron: '0 12 * * *'   # daily 07:00 America/Chicago
    - cron: '0 13 * * 1'   # weekly 08:00 Monday
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ vars.BASE_URL }}/api/cron/daily"
```

---

## 12. All Fixes Applied (chronological)

### 12.1 Schema & build errors (first pass)
- `prisma/schema.prisma`: added `Employee.accountId/account` and `Applicant.jobPostingId/jobPosting` — fixed **P1012** ("missing an opposite relation field").
- `tsconfig.json`: restored `baseUrl: "."` + `paths: { "@/*": ["./src/*"] }` — Next had regenerated it without them → `Module not found: Can't resolve '@/lib/db'`.
- `src/lib/email.ts`: removed duplicate `welcomeEmailHtml` definition.
- `src/app/api/portal/[token]/route.ts`: split `employee.name` into first/last (was `undefined undefined`).

### 12.2 Idempotent seed
- `prisma/seed.ts`: wipe sample records (FK-safe order) before reseeding → `npm run db:seed` safe to re-run (fixed **P2002** on `Invoice.number`).

### 12.3 Dependabot remediation (82 → 0 alerts)
- Root cause: 75 alerts were `next` — all patched versions ≥15.5.x; **14.2.x has no fix**. Upgraded `next` 14.2.35 → **15.5.29**, `react` 18.3.1 → **19.3.1**.
- Removed `zod` (unused in source; 3 high alerts; no fix in v3).
- `postcss` 8.4.31 → 8.5.33 via new `pnpm-workspace.yaml` override (4 alerts).
- Aligned `employee-onboarding/package.json` the same way.
- **First-ever build-enforced type check** caught 4 pre-existing bugs, all fixed:
  1. `SmsPayload` gained optional `applicantId` (pass-through to `Notification`).
  2. `Employee.position` → `role` in portal API + sign email.
  3. "Onboarding Complete: undefined undefined" email → `emp.name`.
  4. `useSearchParams()` wrapped in `<Suspense>` in `/apply/success` (Next 15 prerender requirement).
- Next 15 migration: async `params` (`Promise<{…}>` + `await params`) in 5 server files.
- Disk was full (`os error 112`, ~576 KB free) — cleared only regenerable caches (pnpm store, npm cache, `.next` dev artifacts, deprecated `employee-onboarding/node_modules`); no source or user data touched.

### 12.4 Unified dashboard + landing page
- Business OS becomes the single host; dropshipping bridge proxied under `/bridge/*` via new `next.config.js` rewrites.
- New `/dropshipping` page: server component aggregating bridge orders, agents, config, sync status; graceful offline panel.
- New landing page at `/` (replaced the `/dashboard` redirect): hero, two product cards, quick stats, links.
- Sidebar: "Dropshipping Bridge" section added.
- Verified live: `/`, `/dropshipping`, `/bridge/api/control/status`, `/dashboard` all 200; bridge data renders live.

---

## 13. Known Issues / Open Threads

| Item | Status |
|---|---|
| `GH_PAT` for dropshipping bridge auto-sync | **Pending user action** — paste into bridge `.env` as `GH_PAT=…` (fine-grained, Contents R/W on Lines-and-Logos), restart bridge, I'll verify without reading it |
| `LICENSE` file at repo root | Not yet committed — MIT designated; tracked in roadmap v1.1.0 |
| GitHub Actions CI | Not yet committed — tracked in roadmap v1.1.0 |
| Cron workflow (`.github/workflows/cron.yml`) | Not yet committed — tracked in roadmap v1.1.0 |
| Next.js workspace-root warning | Cosmetic — `package-lock.json` at `C:\Users\Project Zero`; fix via `outputFileTracingRoot` in `next.config.js` |
| 82 Dependabot alerts | **0 open** (verified via `gh api`) after the Next 15 upgrade |
| `employee-onboarding/` | Deprecated & merged; tracked files include npm install logs (junk) — could be removed in a cleanup pass |

---

## 14. Security Notes

- No authentication enforced on any route (dev/single-operator scope) — add NextAuth/Clerk before any network exposure.
- Cron routes are **open** if `CRON_SECRET` is unset (the check is `process.env.CRON_SECRET && auth !== …`).
- `.env*` git-ignored; never committed.
- SQLite dev DB is a plain file (`prisma/dev.db`).
- E-signatures are stored strings, not PKI-backed.
- `LinesAndLogos-Launcher.exe` is unsigned.
- 0 open Dependabot alerts after the Next 15 upgrade.

---

## 15. Troubleshooting Quick Reference

| Error | Fix |
|---|---|
| `npm run dev` → "Missing script: dev" | `cd business-os` first |
| `EADDRINUSE: address already in use :::3001` | Kill the stale PID (`netstat -ano \| findstr :3001` → `Stop-Process -Id <PID> -Force`) |
| `prisma db push` → P1012 (missing opposite relation) | Add inverse fields on both models, then `db push && prisma generate` |
| `prisma db seed` → P2002 (Invoice.number) | Wipe `prisma\dev.db`, re-push, re-generate, re-seed (current seed is idempotent) |
| `Module not found: Can't resolve '@/lib/db'` | Restore `baseUrl: "."` + `paths` in `tsconfig.json` |
| Pages slow on first hit (15–160 s) | Expected in dev (JIT compile); use `npm run build` + `npm start` for prod |
| `npm install` hangs | Use `pnpm install` |
| `useSearchParams() should be wrapped in a suspense boundary` | Wrap the component in `<Suspense>` (Next 15 requirement) |
| `Object literal may only specify known properties` | Add the missing field to the interface (e.g., `SmsPayload.applicantId`) |

---

## 16. Git History (this session)

| Commit | Description |
|---|---|
| `4a80705` | Add `LinesAndLogos-Launcher.exe` for local dev use |
| `f65adfd` | Make db:seed idempotent and fix build errors |
| `3f86953` | Add enterprise README (Business OS + deliverables kit) |
| `0ab1693` | Fix Dependabot exposure: Next 15.5.29 + React 19, remove zod, postcss override |
| `2d213ca` | Unify both apps into one dashboard + add landing page |

All pushed to `origin/master` of `github.com/ProjectZeroDays/Lines-And-Logos`.

---

## 17. Conversation Timeline (summary)

1. **Prospecting & deliverables** — Built Tier 1/2/3 Memphis prospect databases, computed-scores CSV, offer menu, battle card, outreach sequences, proposals (Gym Refresh, Campus Branding, Full Facility + calculators), photo shot list, social calendar, referral one-pager, vendor checklist, 90-day launch plan, Business Automation Blueprint (63 prompts, ~$115k/yr), Business Plan outline, Summer Install Calendar.
2. **Repo bootstrap** — Created git repo, 194 files, pushed to GitHub, built `LinesAndLogos-Launcher.exe` via PyInstaller, attached to release `v1.0.0`.
3. **Business OS build** — Unified `employee-onboarding` into `business-os`: 59 pages, 24 API routes, 35 Prisma models, 9 AI agents, 1099 onboarding flow, sidebar layout, pnpm lock.
4. **First test/debug loop** — Fixed schema relation inverses (P1012), tsconfig paths, duplicate `welcomeEmailHtml`, portal name split; verified all routes 200; full apply→approve→sign flow works.
5. **db:seed loop** — Made seed idempotent (P2002 fix); re-verified.
6. **Enterprise README** — Generated Fortune-500-style README at repo root; committed/pushed.
7. **Dependabot fix** — Upgraded Next 14→15.5.29 + React 19, removed zod, postcss override; Next 15 async-params migration; build-enforced type check uncovered 4 real bugs; 82→0 alerts; pushed.
8. **Unified dashboard** — Business OS as single host, dropshipping bridge proxied under `/bridge/*`, new `/dropshipping` page, real landing page at `/`; built & smoke-tested; pushed.
9. **Client build** — User building the dropshipping React client (`client/`, Vite + React 18) with `npm run build` (in progress at handover).

---

## 18. What Kimi Should Do Next

1. **Build the dropshipping client** (if not done): `cd C:\Projects\autonomous-dropshipping-shopify-taskade-app\client && npm run build`, then restart the bridge (`npm start`) so it serves the new `dist/`.
2. **Add GH_PAT** to the bridge `.env` (fine-grained PAT, Contents R/W on Lines-and-Logos), restart, verify `/api/sync/status` and the auto-sync commits.
3. **Commit the `LICENSE` (MIT)** file at repo root (tracked in roadmap v1.1.0).
4. **Add GitHub Actions CI** (install → prisma generate → next build → type-check) — the README references a `ci.yml` that doesn't exist yet.
5. **Optional cleanup:** remove `employee-onboarding/` from git (deprecated, merged) and the tracked npm error logs; fix the Next workspace-root warning via `outputFileTracingRoot` in `next.config.js`.
6. **Optional upgrades:** multi-tenant + RBAC + auth (roadmap v2.0), Stripe live keys, DocuSign.

---

*Handover generated from the session thread. All paths are Windows-absolute; substitute your own root if different.*
