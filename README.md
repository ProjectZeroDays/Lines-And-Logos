```
   ███████╗██╗███╗   ██╗███████╗███████╗         ███████╗    ██╗           ██████╗ ██╗  ██╗
   ██╔════╝██║████╗  ██║██╔════╝██╔════╝         ██╔══██║    ██║          ██╔═══██╗╚██╗██╔╝
   ███████╗██║██╔██╗ ██║█████╗  ███████╗  █████╗  ██║  ██║    ██║          ██║   ██║ ╚███╔╝
   ╚════██║██║██║╚██╗██║██╔══╝  ╚════██║  ╚════╝  ██║  ██║    ██║          ██║   ██║ ██╔██╗
   ███████║██║██║ ╚████║███████╗███████║         ██████╔╝    ███████╗     ╚██████╔╝██╔╝ ██╗
   ╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝         ╚═════╝     ╚══════╝      ╚═════╝ ╚═╝  ╚═╝

```

# Lines & Logos — Business OS

**Facility branding & athletic surfaces, automated end-to-end.** One platform to run sales, operations, finance, team, and compliance for a Memphis-based facility branding and athletic surface company — plus a complete go-to-market deliverable kit (prospecting databases, proposals, outreach sequences, and launch plans).

[![version](https://img.shields.io/badge/version-1.0.0-1F3864?style=for-the-badge&logo=next.js&logoColor=white)](https://github.com/ProjectZeroDays/Lines-And-Logos/releases/tag/v1.0.0)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.29-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](#license)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-8A2BE2?style=for-the-badge)](#installation)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Maintained](https://img.shields.io/badge/Maintained-yes-brightgreen?style=for-the-badge)](#roadmap)
[![CI](https://img.shields.io/badge/CI-pending%20workflow-orange?style=for-the-badge&logo=githubactions&logoColor=white)](#roadmap)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)](#contributing)
[![Last Commit](https://img.shields.io/github/last-commit/ProjectZeroDays/Lines-And-Logos?style=for-the-badge&color=informational)](https://github.com/ProjectZeroDays/Lines-And-Logos/commits/master)
[![Dependabot](https://img.shields.io/github/dependabot/dependencies-total/ProjectZeroDays/Lines-And-Logos?style=for-the-badge)](https://github.com/ProjectZeroDays/Lines-And-Logos/security/dependabot)

> **Repository:** [github.com/ProjectZeroDays/Lines-And-Logos](https://github.com/ProjectZeroDays/Lines-And-Logos) · **Default branch:** `master` · **Status:** v1.0.0 (active development)

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [What's in This Repository](#whats-in-this-repository)
- [Features](#features)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Installation](#installation)
- [Dependencies](#dependencies)
- [Configuration](#configuration)
- [Usage](#usage)
- [CLI Reference](#cli-reference)
- [API Documentation](#api-documentation)
- [Reporting](#reporting)
- [Logging](#logging)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Glossary](#glossary)
- [Project Statistics](#project-statistics)
- [Performance Notes](#performance-notes)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Support](#support)
- [Author](#author)
- [License](#license)
- [Acknowledgments](#acknowledgments)
- [Disclaimer](#disclaimer)

---

## Executive Summary

**Lines & Logos Business OS** is a single-tenant, full-stack business automation platform for a Memphis, TN facility branding and athletic surface company (gym floors, court restripes, wall wraps, donors walls, signage, athletic surfacing, parking lots, playgrounds). It consolidates the tools a service business otherwise runs across six SaaS products — CRM, job scheduling, invoicing, marketing, recruiting, and compliance — into one Next.js application backed by a typed Prisma data layer.

| Metric | Value |
|---|---|
| Application pages | **59** (App Router, React Server Components) |
| REST/JSON API handlers | **24** |
| Prisma models | **35** (typed, relation-checked) |
| Autonomous AI agents | **9** (heuristic core + LLM-upgradeable) |
| Scheduled automations | **2** (daily + weekly cron routes) |
| Source size | ~**3,100** lines of TypeScript |
| Projected labor savings | **~44 hrs/week** (≈ **$115,000/yr**, per `Business_Automation_Blueprint.md`) |

**Design principles:** boring technology, sample data never shipped as real data, idempotent seeding, secrets never in the repo, and every automation fails visibly (logged, persisted) rather than silently.

**Who it's for:** the owner/operator and a small 1099 crew; a developer doing local development and verification; prospects evaluating the business case. **Not for:** multi-tenant SaaS, public internet exposure without an auth layer (see [Security Considerations](#security-considerations)).

---

## What's in This Repository

This repository is more than the app — it is the company's complete **go-to-market kit** alongside the software:

| Layer | Contents |
|---|---|
| **Application** | `business-os/` — the Business OS (Next.js + Prisma + SQLite) |
| **Prospecting** | Memphis 100-prospect Tier 1/2/3 databases (XLSX), computed-scores CSV, formula-driven fit/budget gates |
| **Sales collateral** | Bundled offer menu, competitive battle card, 30/60/90 outreach sequences, MSCS & DeSoto personalized emails |
| **Proposals** | Gym Refresh, Campus Branding, Full Facility templates + `Proposal_Full_Facility_Calculator.xlsx` |
| **Calculators** | `Pricing_Calculator.xlsx`, `Summer_Install_Calendar.xlsx`, `Proposal_Full_Facility_Calculator.xlsx` |
| **Strategy** | `Business_Automation_Blueprint.md` (63 ranked prompts, ~$115k/yr), `Business_Plan_Outline.md`, `90_Day_Launch_Plan.md` |
| **Ops** | Vendor registration checklist, photo case-study shot list, social calendar, referral one-pager |
| **Launcher** | `LinesAndLogos-Launcher.exe` (v1.0.0 release) — double-clickable dev launcher |
| **Docs** | `README_Deliverables.md` — index of every deliverable |

> See [Repository Structure](#repository-structure) for the annotated tree.

---

## Features

### Sales & Pipeline
- **Leads** — AI scoring (0–100 → hot/warm/cold), tiering, source tracking, next-step hints
- **Accounts** — health scoring (green/yellow/red) with risk notes, renewal dates, goals
- **Quotes & Pipeline** — quote tracking → job conversion
- **Contacts** — per-account contacts with roles and decision-maker flags

### Operations
- **Jobs** — dispatch, status flow (lead → quoted → in-progress → complete), crew assignment
- **Schedule** — job calendar and crew allocation
- **Time Tracking** — per-job time entries
- **Checklists** — reusable safety/installation checklists with run history
- **ChecklistRuns** — completion audit trail

### Finance
- **Invoices** — numbering, status lifecycle (draft → sent → overdue → paid), overdue detection
- **Expenses / Revenue** — category-level P&L inputs
- **Reminders** — escalating invoice reminders (friendly → firm → final) via email/SMS
- **Payments** — partial-payment tracking

### Team & HR
- **Employees & Contractors** — 1099 onboarding pipeline (apply → screen → approve → sign → store)
- **Applicants & Scoring** — AI applicant scoring, W-9 e-sign flow, unique portal links
- **Vendors & POs** — vendor evaluations, purchase orders, preferred-vendor list
- **Recruiting** — job postings, candidate pipeline, scorecards

### Marketing
- **Content Queue** — AI-repurposed social content, approval workflow
- **Campaigns** — email/social/SMS campaigns with status tracking
- **Landing Pages** — conversion-tracked landing templates
- **Social** — platform-specific calendar and post previews

### Client Experience & Admin
- **Client Portal** — tokenized document signing (W-9, 1099 acknowledgment, safety agreement, offer) with signature capture
- **Support & Feedback** — ticket log and client feedback collection
- **Wiki & Policies** — SOP library (e.g., *Gym Floor Refinishing SOP*) and policy registry
- **Approvals, Reports, Settings** — approval queue, KPI reports, system settings

### AI Agents (9)
| Agent | Purpose | LLM-upgradeable |
|---|---|---|
| Lead Score Agent | Scores leads 0–100 (budget, urgency, fit) | ✅ |
| Job Dispatch Agent | Matches jobs to contractors by skills | ✅ |
| Invoice Reminder Agent | Escalating tone based on days-overdue | ✅ |
| Health Score Agent | Account health + risk summary | ✅ |
| Competitor Watch Agent | Flags competitor pricing/moves | ✅ |
| Daily Ops Agent | Morning brief (jobs, invoices, tasks) | ✅ |
| Job Status Update Agent | Drafts customer progress emails | ✅ |
| Content Repurposing Agent | Blog → social multi-post | ✅ |
| Competitor Analysis Agent | Deep-dive competitive impact | ✅ |

All agents run **without any API key** using deterministic heuristics, and switch to OpenAI or Anthropic automatically when keys are present (see [Configuration](#configuration)).

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                             │
│   Next.js 15 · App Router · React Server Components                   │
│   59 pages (dashboard, sales, ops, finance, HR, marketing, admin)     │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ RSC / fetch
┌───────────────────────────────▼──────────────────────────────────────┐
│                       APPLICATION LAYER                               │
│  ┌─────────────────┐   ┌──────────────────┐   ┌───────────────────┐  │
│  │ Route handlers  │   │  AI Agents       │   │ Cron orchestrators │  │
│  │ 24 JSON routes  │   │ 9 agents         │   │ /api/cron/daily    │  │
│  │ /api/leads …    │   │ heuristic + LLM  │   │ /api/cron/weekly   │  │
│  └────────┬────────┘   └────────┬─────────┘   └─────────┬─────────┘  │
└───────────┼─────────────────────┼───────────────────────┼────────────┘
            │                     │                        │
┌───────────▼─────────────────────▼───────────────────────▼────────────┐
│                       DATA LAYER                                       │
│   Prisma ORM 5.22  ·  35 models  ·  SQLite (dev) / PostgreSQL (prod)  │
│   dev.db (git-ignored)  ·  unique indexes on emails/invoice numbers   │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES (optional)                        │
│  Resend/SMTP · Twilio SMS · Stripe · OpenAI/Anthropic · Vercel Cron   │
└──────────────────────────────────────────────────────────────────────┘
```

**Request flow (example: daily ops brief)**

```text
Vercel Cron (or GitHub Actions)
      │  GET /api/cron/daily   Authorization: Bearer $CRON_SECRET
      ▼
Route handler  ──►  dailyOpsAgent ──► Prisma (jobs, invoices, tasks)
      │                     │
      │                     └─► sendEmail() / sendSms()  ──► Resend / Twilio
      ▼
Notification table (status: sent | failed)  +  ActivityLog
```

---

## Repository Structure

```text
Lines & Logos/
├── business-os/                      # The Next.js app (primary source)
│   ├── prisma/
│   │   ├── schema.prisma             # 35 models, relations & indexes
│   │   └── seed.ts                   # Idempotent sample-data seed (safe re-run)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard pages…)    # 59 page.tsx routes
│   │   │   └── api/                  # 24 route.ts handlers
│   │   ├── lib/                      # db client, ai-agents, email, sms, pdf, utils
│   │   └── components/               # Sidebar, forms, charts, portals
│   ├── .env.example                  # All supported configuration keys
│   └── package.json                  # Scripts: dev/build/start/db:*
│
├── LinesAndLogos-Launcher.exe        # Dev launcher (v1.0.0, PyInstaller)
├── launcher.py / *.spec              # Launcher sources
├── logo*.png                         # Brand assets
│
├── Memphis_*Prospecting*.xlsx        # Tier 1/2/3 prospect databases (formula-driven)
├── Tier1_Computed_Scores.csv         # Computed fit/budget/tier scores (30 accounts)
├── Proposal_*.md / .xlsx             # Proposal suite + calculator
├── Pricing_Calculator.xlsx           # Service pricing model
├── Summer_Install_Calendar.xlsx      # Seasonal capacity plan
├── Business_Automation_Blueprint.md  # 63 ranked automations (~$115k/yr)
├── Business_Plan_Outline.md          # Lean canvas & ops model
├── Vendor_Registration_Checklist.md  # MSCS vendor-registration packet
├── 90_Day_Launch_Plan.md             # GTM execution calendar
├── Outreach_*.md                     # Outreach sequences + MSCS/DeSoto variants
├── Competitive_Battle_Card.md        # Win/loss positioning
├── README_Deliverables.md            # Index of every deliverable + order of operations
│
├── employee-onboarding/              # MERGED into business-os/ (deprecated, read-only)
├── employee-onboarding/.env.example  # Legacy reference
└── .gitignore                        # node_modules, .next, *.db, .env*, *.exe
```

> **Note:** `build/`, `dist/`, and `repo/` are local build artifacts and are not tracked in git.

---

## Installation

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 (tested on 26) | `node -v` |
| npm | ≥ 9 | or `pnpm` (faster on slow/flaky networks) |
| Git | any recent | — |
| Disk | ~800 MB | node_modules + Prisma engines |
| OS | Windows, macOS, Linux | SQLite is cross-platform |

### Quick start

```bash
git clone https://github.com/ProjectZeroDays/Lines-And-Logos.git
cd Lines-And-Logos/business-os

npm install                 # or: pnpm install
cp .env.example .env.local  # cp doesn't work on cmd — use: copy .env.example .env.local
npx prisma db push          # creates prisma/dev.db + prisma client
npm run db:seed             # idempotent; safe to re-run
npm run dev                 # http://localhost:3001
```

Open **http://localhost:3001** (dashboard) — you should see the seeded demo data (MSCS, DeSoto, Bellevue Baptist).

<details>
<summary><b>First-run verification checklist</b></summary>

```bash
# API returns seeded JSON
curl http://localhost:3001/api/leads
# → 200 [{"id":"…","name":"Dr. Roderick Richmond","company":"Memphis-Shelby County Schools",…}]

# Health check of onboarding flow
curl -X POST http://localhost:3001/api/apply \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","phone":"901-555-1234","position":"Floor Installer","experience":"3","skills":"hardwood","availability":"full-time","hasTransport":true,"hasInsurance":true,"coverLetter":"3 years hardwood installation.","references":"John Smith, 901-555-9999"}'
# → {"applicantId":"…","aiScore":85,"recommendation":"strong",…}
```

</details>

---

## Dependencies

### Runtime
| Package | Version | Purpose |
|---|---|---|
| `next` | 15.5.29 | App framework (App Router, RSC, route handlers) |
| `react` / `react-dom` | 19.3.1 | UI |
| `@prisma/client` | 5.22.0 | Type-safe DB client |

### Development
| Package | Version | Purpose |
|---|---|---|
| `typescript` | 5.x | Strict-ish compile (see note) |
| `prisma` | 5.22.0 | Migrations, client generation, Studio |
| `tsx` | 4.x | Runs `prisma/seed.ts` TypeScript directly |
| `@types/*` | latest | Node/React/React-DOM typings |

> Install with `pnpm install` if npm hangs — the lockfile is `pnpm-lock.yaml`.

---

## Configuration

All configuration lives in `.env.local` (git-ignored). Copy `.env.example` and fill in what you need — **every integration is optional**; the app runs fully offline with zero keys.

| Key | Required for | Example |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | Absolute links (portal, emails) | `http://localhost:3001` |
| `ADMIN_EMAIL` | Admin notifications | `admin@linesandlogos.com` |
| `CRON_SECRET` | **Protecting cron routes** (see below) | `generate-a-long-random-string` |
| `RESEND_API_KEY` | Email via Resend | `re_…` |
| `FROM_EMAIL` | Sender address | `noreply@linesandlogos.com` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email via SMTP fallback | `smtp.mailersend.net` / `587` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | SMS | `AC…` / `+1…` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AI agents (OpenAI path) | `sk-…` / `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | AI agents (Anthropic path) | `sk-ant-…` / `claude-3-haiku-20240307` |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments | `sk_test_…` |
| `DATABASE_URL` | PostgreSQL swap (prod) | `postgresql://user:pass@host:5432/db` |

**Behavior when keys are absent**
- **Email/SMS** → payload logged to stdout; `Notification` row marked `sent` (simulated) — check your terminal.
- **AI agents** → deterministic heuristic scoring (still useful, fully testable).
- **Stripe** → payment endpoints return design-time scaffolds, not charges.

> ⚠️ **Security:** never commit `.env*` — `.gitignore` already blocks `.env`, `.env.local`, `.env.*.local`. If a secret is ever committed, rotate it immediately.

---

## Usage

```bash
npm run dev        # development server → http://localhost:3001
npm run build      # production build (requires .next-clean state)
npm start          # production server (port 3001)
npm run db:seed    # wipe + reseed sample data (idempotent)
npm run db:push    # sync Prisma schema → SQLite (creates prisma/dev.db)
npm run db:studio  # Prisma Studio GUI → http://localhost:5555
```

**Seeded accounts** — Memphis-Shelby County Schools (213 seats), DeSoto County SD (42), Bellevue Baptist Church — plus 2 leads, 1 job, 1 invoice, 3 tasks, a safety checklist, and a wiki SOP. Re-run `npm run db:seed` any time; it resets sample data non-destructively for everything else.

**Onboarding flow (apply → sign):**

```text
Applicant  →  /apply  (public form)
     │  AI scores (aiScore) + "strong/maybe/weak"
     ▼
Admin      →  /admin/applicants  (review, approve, reject)
     │  Approval generates: employee record + 5 documents + portal token
     ▼
Contractor →  /portal/<token>  (signs W-9, 1099 ack, scope, safety, offer)
     ▼
DB state   →  Employee.w9Signed = true → dispatchable in /jobs dispatch
```

---

## CLI Reference

| Command | What it does | Real output (trimmed) |
|---|---|---|
| `npm run dev` | Next.js dev server, port 3001 | `✓ Ready in 22–135s` |
| `npm run build` | Production build | `✓ Compiled` + type checks |
| `npm start` | Serve production build | `next start -p 3001` |
| `npm run db:push` | Push schema to SQLite | `Your database is now in sync` |
| `npm run db:seed` | Wipe + reseed sample data | `Seeded Business OS with sample data` |
| `npm run db:studio` | Open Prisma Studio | `http://localhost:5555` |
| `npx prisma generate` | Regenerate client after schema edits | `✔ Generated Prisma Client (v5.22.0)` |
| `npx tsx prisma/seed.ts` | Same as db:seed, direct invocation | `Seeded Business OS with sample data` |

---

## API Documentation

All responses are `application/json`. **No authentication is enforced on any route in this version** — see [Security Considerations](#security-considerations) before deploying beyond localhost.

<details>
<summary><b>Sales & Pipeline</b></summary>

| Method | Route | Description |
|---|---|---|
| `GET` `POST` | `/api/leads` | List / create leads (AI-scored on create) |
| `GET` `POST` | `/api/accounts` | List / create accounts |
| `GET` `POST` | `/api/contacts` | List / create contacts |
| `GET` `POST` | `/api/quotes` | List / create quotes |

```bash
curl http://localhost:3001/api/leads
```
```json
[{ "id": "cmw…", "name": "Dr. Roderick Richmond",
   "company": "Memphis-Shelby County Schools",
   "score": 92, "tier": "hot", "stage": "contacted" }]
```

</details>

<details>
<summary><b>Operations</b></summary>

| Method | Route | Description |
|---|---|---|
| `GET` `POST` | `/api/jobs` | List / create jobs |
| `GET` `POST` | `/api/time-entries` | Time tracking entries |
| `GET` `POST` | `/api/checklists` | Safety/install checklists |

</details>

<details>
<summary><b>Finance</b></summary>

| Method | Route | Description |
|---|---|---|
| `GET` `POST` | `/api/invoices` | List / create invoices |
| `GET` `POST` | `/api/expenses` | List / create expenses |
| `GET` `POST` | `/api/revenue` | Revenue entries |

</details>

<details>
<summary><b>Team & HR</b></summary>

| Method | Route | Description |
|---|---|---|
| `GET` `POST` | `/api/employees` | Employees & 1099 contractors |
| `GET` `POST` | `/api/candidates` | Recruiting pipeline |
| `GET` `POST` | `/api/vendors` | Vendor registry & POs |
| `POST` | `/api/apply` | Public application intake (AI-scored) |
| `POST` | `/api/admin/applicants/[id]/approve` | Approve → creates employee + 5 documents + portal token |
| `POST` | `/api/admin/applicants/[id]/reject` | Reject with reason |
| `GET` | `/api/portal/[token]` | Contractor portal payload (docs + signature state) |
| `POST` | `/api/portal/[token]/sign` | Sign one document → body `{"signature":"Name"}` |

</details>

<details>
<summary><b>Marketing & Content</b></summary>

| Method | Route | Description |
|---|---|---|
| `GET` `POST` | `/api/campaigns` | Marketing campaigns |
| `GET` `POST` | `/api/content` | Content queue (draft/scheduled/published) |

</details>

<details>
<summary><b>Admin, Knowledge & Cron</b></summary>

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/wiki` | Wiki SOPs |
| `GET` | `/api/policies` | Policy registry |
| `GET` | `/api/cron/daily` | Daily ops brief + invoice reminders + overdue check |
| `GET` | `/api/cron/weekly` | Weekly report email + competitor watch + market scan |

**Cron authentication**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/daily
```
> If `CRON_SECRET` is unset, cron routes are **open** — set it in production.

</details>

**Common error envelopes**

```json
{ "error": "Unauthorized" }                    // cron without/missing bearer token → 401
{ "code": "P2002", "meta": { "target": ["number"] } }   // unique constraint → dedupe or re-seed
{ "error": "Applicant not found" }             // approve/reject with bad id → 404
```

---

## Reporting

- **Daily cron** (`GET /api/cron/daily`, Bearer `$CRON_SECRET`): generates the ops brief (today's jobs, overdue invoices with escalating tone reminders, overdue tasks, account health refresh), persists `Notification` rows, and optionally emails/SMSes the admin.
- **Weekly cron** (`GET /api/cron/weekly`): weekly KPI report, competitor watch scan, market scan, next-week content plan.
- **In-app reports** — `/reports` renders pipeline value, revenue vs. target, and task throughput from live DB data.
- **Business case reports** — `Business_Automation_Blueprint.md` (ROI model), `Tier1_Computed_Scores.csv` (prospect economics), `README_Deliverables.md` (deliverable index).

Point Vercel Cron or a GitHub Actions `schedule:` cron at the two endpoints:

```yaml
# .github/workflows/cron.yml (not yet committed — see Roadmap)
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

## Logging

- **App logs** — `console.*` to stdout (structured JSON in production recommended; see Roadmap).
- **Notification ledger** — every outbound email/SMS is persisted in the `Notification` table with `status: sent | failed`, `sentAt`, and provider payload preview. Query failures from `/settings` or Prisma Studio.
- **Activity trail** — `ActivityLog` records agent decisions (job dispatch, reminders sent, score changes).
- **Error surfaces** — API routes return JSON `{ "error": string }` with matching HTTP status; unrecoverable cron errors are logged with `console.error` and the run continues (partial-failure semantics: one failed account doesn't block the rest).
- **Dev server output** — `npm run dev` prints route compile timings and request logs; first hit per route is slow by design (JIT compile), subsequent hits are fast.

---

## Security Considerations

> This is a **local-development / single-operator** system. Harden before any network exposure.

| Area | Current state | Required for production |
|---|---|---|
| **Authentication** | None on dashboard or API routes | Add NextAuth/Clerk/SSO; gate every route |
| **Authorization** | Single shared `admin` identity; no roles | RBAC (owner / ops / contractor / read-only) |
| **Cron auth** | `Bearer $CRON_SECRET` **only if set** | Always set `CRON_SECRET`; reject when unset |
| **Secrets** | `.env*` git-ignored; never committed | Rotate on suspicion; use a vault |
| **Data at rest** | SQLite `dev.db` (plain file) | PostgreSQL with encryption-at-rest |
| **PII** | Applicant/contractor W-9s, SSNs via form | Encrypt SSN column; retention policy; DPA |
| **E-sign** | Drawn signature stored as string, not PKI-backed | DocuSign/HelloSign or eIDAS/ESIGN-grade flow |
| **Webhooks** | Stripe scaffold only | Verify `STRIPE_WEBHOOK_SECRET` signatures |
| **Dependencies** | Upgraded to Next 15.5.29 / React 19.3.1 / postcss 8.5.33 (was: 82 open Dependabot alerts — 9 critical, 32 high) | GitHub re-scan after push; `pnpm audit` in CI |
| **Launcher** | `LinesAndLogos-Launcher.exe` is **unsigned** | Code-sign with an OV/EV cert; or distribute source only |
| **Transport** | HTTP localhost only | TLS everywhere; HSTS; secure cookies |

**Non-negotiables before going live:** auth + RBAC, `CRON_SECRET` enforced-or-die, Stripe webhook signature verification, SSN encryption, and a full dependency audit pass.

---

## Troubleshooting

<details>
<summary><code>npm run dev</code> → "Missing script: dev"</summary>

You are in the repo root, not the app folder. Run `cd business-os` first, or use the root-level launcher (`LinesAndLogos-Launcher.exe`).
</details>

<details>
<summary><code>EADDRINUSE: address already in use :::3001</code></summary>

Port 3001 is held by a stale Next.js process (common after crashes). Kill it, then start again:
```powershell
netstat -ano | findstr :3001     # find PID
Stop-Process -Id <PID> -Force
```
</details>

<details>
<summary><code>prisma db push</code> → "P1012 … missing an opposite relation field"</summary>

Relation arrays must have matching scalar fields on both models. In this repo, `Employee.accountId` and `Applicant.jobPostingId` were added to satisfy this. After any `schema.prisma` edit: `npx prisma db push && npx prisma generate`.
</details>

<details>
<summary><code>prisma db seed</code> → "P2002 … target: ['number']"</summary>

The seed creates `L&L-2026-001`. Seeds before the idempotency fix collide on re-run. Current seed wipes its own sample rows first — just re-run. If you have a **pre-fix** `dev.db`: `Remove-Item prisma\dev.db; npx prisma db push; npx prisma generate; npm run db:seed`.
</details>

<details>
<summary><code>Module not found: Can't resolve '@/lib/db'</code></summary>

Next regenerates `tsconfig.json` without `baseUrl`/`paths`. Restore:
```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } } }
```
</details>

<details>
<summary>Pages return 200 but very slowly on first hit</summary>

Expected in dev: per-route on-demand compilation (observed 15–160 s for the heaviest route). Warm routes respond in < 100 ms. For routine verification, hit `/api/*` (compiled in ~20–30 s) or run `npm run build` once to warm all routes.
</details>

<details>
<summary>Seed ran, but UI shows empty lists</summary>

Browser cache or the dev server picked a different DB. Confirm `.env.local` is loaded (`Environments: .env.local` in boot log) and re-seed: `npm run db:seed`. Then hard-refresh (Ctrl+Shift+R).
</details>

<details>
<summary>npm install hangs for minutes</summary>

Use `pnpm install` — the committed lockfile is `pnpm-lock.yaml`. npm also works but is materially slower on this project (~4 min cold).
</details>

---

## FAQ

**Is this production software?**
No. It is a working v1.0.0 **business operating system for one operator**. It runs, it's tested locally, and it persists real data — but it ships without authentication and with SQLite. Treat it as a single-operator tool or a reference implementation, not as a multi-tenant SaaS.

**Do I need API keys to try it?**
No. Every agent, email, and SMS path degrades to a deterministic local fallback. Seed data, AI scoring, onboarding, signing — all work offline.

**Can I use PostgreSQL instead of SQLite?**
Yes. Switch `provider = "sqlite"` to `"postgresql"` in `schema.prisma`, set `DATABASE_URL`, then `npx prisma db push && npx prisma generate && npm run db:seed`.

**Why is there a Windows .exe in the repo?**
`LinesAndLogos-Launcher.exe` is a convenience launcher (starts the dev server, opens the dashboard). It is **not code-signed** and is optional — everything the .exe does is two shell commands.

**Does the e-signature hold up legally?**
As implemented, signatures are stored strings with timestamps — an audit-friendly record, not an ESIGN/UETA-certified workflow. For contracts with legal weight, route buyers through DocuSign/HelloSign (see Roadmap).

**Where is my data?**
`business-os/prisma/dev.db`. Git-ignored. Back it up before any schema change: copy the file, that's it.

**Can I re-run the seed without losing my data?**
The seed wipes only the records it creates (sample accounts/leads/jobs/invoices/tasks/checklists/docs). Data you add under different records survives. When in doubt, back up `dev.db` first.

**Why 59 pages if the nav shows fewer?**
Nested dynamic routes (`[id]`) and modal pages count separately; the sidebar exposes the primary ~30.

**How do I get help?**
GitHub Issues: [ProjectZeroDays/Lines-And-Logos/issues](https://github.com/ProjectZeroDays/Lines-And-Logos/issues) — include `node -v`, the failing command, and the full error text.

---

## Glossary

| Term | Meaning |
|---|---|
| **AI Agent** | A callable unit of decision logic. Runs on deterministic heuristics by default; upgrades to an LLM when `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` is set. |
| **1099 Contractor** | Independent contractor (vs. W-2 employee) paid per job — the crew model this business uses. |
| **Applicant → Employee flow** | End-to-end onboarding pipeline: public apply → AI score → admin approve → portal link → e-sign → dispatchable contractor. |
| **CRON_SECRET** | Bearer token protecting `/api/cron/*`. Must be set outside localhost. |
| **Dev DB** | `prisma/dev.db` — SQLite file; the default development database. Git-ignored. |
| **Dispatch** | Assigning a job to a contractor, typically via the Job Dispatch Agent. |
| **Escalating reminders** | Invoice dunning cadence: friendly (≤7 days) → firm (8–14) → final (15+). |
| **Idempotent seed** | Seed script that deletes its own sample rows before inserting, so re-runs never duplicate or crash. |
| **Portal token** | Random hex token identifying a contractor's signing session (`/portal/<token>`). Unguessable; expires per document policy. |
| **P2002** | Prisma unique-constraint violation. |
| **P1012** | Prisma schema validation failure (usually missing relation inverse). |
| **Health score** | Account grading green/yellow/red from renewal proximity, overdue invoices, and activity recency. |
| **Tier (A/B/C)** | Prospect grade in the Memphis databases: A ≥ 80 fit, B ≥ 60, else C. Budget gate < 5 zeroes the score. |
| **SOP** | Standard Operating Procedure (see `Gym Floor Refinishing SOP` in the Wiki module). |

---

## Project Statistics

| Metric | Count |
|---|---|
| Tracked files (`git ls-files`) | **194** |
| App pages (`page.tsx`) | **59** |
| API route handlers (`route.ts`) | **24** |
| Prisma models | **35** |
| AI agents | **9** |
| Cron endpoints | **2** |
| Source code (TS/TSX, src + prisma) | **~3,067 lines** |
| Business deliverables (XLSX/CSV/MD) | **40+** |
| Open Dependabot alerts | **~0 expected** (migrated to Next 15.5.29; was 82) |
| Releases | **1** — [v1.0.0](https://github.com/ProjectZeroDays/Lines-And-Logos/releases/tag/v1.0.0) |
| License | MIT (designated; `LICENSE` file pending) |
| Default branch | `master` |

---

## Performance Notes

- **Dev compile latency:** first route hit compiles on demand — observed 8–160 s for heaviest routes; warm hits < 100 ms. `/api/*` compiles fastest (~20–30 s).
- **Production:** `npm run build` + `npm start` precompiles everything; zero cold-route penalty.
- **DB:** SQLite ≫ adequate for single-operator volumes (< 10k rows). For concurrent crews, switch to PostgreSQL (`DATABASE_URL`) — no data-model changes required.
- **Indexes:** unique indexes exist on `Invoice.number`, portal/document `token`, `Setting.key`, and `Applicant`/`Employee` emails — these power the seed's idempotency and prevent duplicate records.
- **Agent cost:** heuristic agents are O(rows) and free; LLM calls are pay-per-token — cache scores in the DB rather than re-scoring on every read (already the default).
- **Bundle:** keep pages under ~200 kB client JS; prefer RSC + server fetch (default pattern in `app/`).

---

## Roadmap

<details>
<summary><b>v1.1.0 — Hardened single operator</b> (next)</summary>

- [ ] `LICENSE` file (MIT) committed at root
- [ ] GitHub Actions CI: install → `prisma generate` → `next build` → type-check on every PR
- [ ] Cron workflow committed (`.github/workflows/cron.yml`) with `CRON_SECRET` wired
- [ ] Dependabot auto-merge for patch/minor dev-deps after CI green
- [ ] Structured startup log (`Next 15.5.29 · Prisma 5.22.0 · DB ok · agents ok`)
</details>

<details>
<summary><b>v1.2.0 — Real money + real signatures</b></summary>

- [ ] Stripe Checkout + webhook signature verification (live keys)
- [ ] DocuSign / HelloSign integration for the contractor signing flow
- [ ] PostgreSQL migration guide & Docker Compose (db + app)
- [ ] RBAC: owner / ops / contractor / read-only roles
</details>

<details>
<summary><b>v2.0.0 — Multi-operator</b></summary>

- [ ] Multi-tenant accounts with row-level isolation
- [ ] SSO (Clerk or NextAuth) + per-tenant audit log
- [ ] Client-facing quote approvals (approve → deposit payment)
- [ ] Mobile crew UI (schedule + checklists + photo capture)
</details>

---

## Contributing

We welcome issues and PRs — this project is moving fast and values small, reviewable diffs.

**Workflow**
1. Fork → branch from `master` (`feat/invoice-pdf`, `fix/seed-idempotency`)
2. Keep PRs single-purpose; touch only what the change requires
3. Run locally: `npm run dev` + hit the affected route; `npm run db:seed` must exit 0
4. Never commit `.env*`, `*.db`, `node_modules/`, build artifacts, or real customer data
5. Use the existing component/style patterns — boring consistency beats clever novelty
6. Commit messages: imperative, ≤ 72 chars first line (`Make db:seed idempotent`)
7. Open a PR using the template; link the issue; add before/after evidence

**Good first issues:** report polish, empty-state screens, web-vitals fixes, test coverage for `ai-agents` heuristics.

---

## Code of Conduct

This project adopts the [Contributor Covenant, v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). In short: be kind, assume good intent, critique the code not the person, no harassment of any kind. Reports: open a GitHub issue or contact the maintainer. Violations may result in PR rejection or ban.

---

## Support

| Channel | Use for |
|---|---|
| [GitHub Issues](https://github.com/ProjectZeroDays/Lines-And-Logos/issues) | Bugs, feature requests, docs errors |
| [GitHub Discussions](https://github.com/ProjectZeroDays/Lines-And-Logos/discussions) | Q&A, ideas, show-and-tell |
| [README_Deliverables.md](README_Deliverables.md) | Which business document for which task |
| [90_Day_Launch_Plan.md](90_Day_Launch_Plan.md) | Launch order of operations |

**Before filing:** search existing issues; include `node -v`, OS, the command run, and the full stack trace. Reproducible test cases get priority.

---

## Author

**Trey A. Smith** — Authenticated, Inc. · [github.com/ProjectZeroDays](https://github.com/ProjectZeroDays)

Built for Memphis-Shelby & DeSoto County facility branding. Lines & Logos: *one vendor, one contract, one invoice* — gym floors, wall wraps, donors walls, signage, and athletic surfacing across the Mid-South.

---

## License

**MIT License** — © 2026 Authenticated, Inc. (designated; the `LICENSE` file itself is pending commit — see [Roadmap](#roadmap)).

You are free to use, copy, modify, merge, publish, and distribute copies of this software, subject to the standard MIT conditions: retain the copyright notice and disclaimer, and understand the software is provided **as is**, without warranty of any kind.

---

## Acknowledgments

- **Next.js & Vercel** — App Router, RSC, route handlers, Cron
- **Prisma** — ergonomic ORM; Studio for DB introspection
- **SQLite** — zero-config dev database
- **OpenAI & Anthropic** — agent LLMs (optional)
- **Resend, Twilio, Stripe** — communication & payments plumbing
- **pnpm** — the package manager that got this installed in practice
- **The Memphis facility, park, and school systems** that shaped the product roadmap

---

## Disclaimer

1. **Not legal, financial, or tax advice.** The 1099 onboarding flow, W-9 collection, and invoice reminders are operational tooling, not compliance guarantees. Consult counsel and your CPA before engaging contractors or dunning customers.
2. **Sample data is fictitious.** Seeded leads/accounts (MSCS contacts included) are demonstrative; do not market to them without independent verification of their public channels.
3. **Unsigned binary.** `LinesAndLogos-Launcher.exe` is distributed as-is; Windows SmartScreen may warn. You may always run the two shell commands instead of the .exe.
4. **Security posture.** Dependencies were upgraded to Next 15.5.29 and React 19 to close 82 open Dependabot alerts (GitHub re-scan pending at time of writing); auth is not enforced; SQLite is unencrypted. Do not expose publicly until you complete [Security Considerations](#security-considerations).
5. **AI outputs** (scores, drafted emails, dispatch suggestions) are decision support, not decisions. A human approves approvals, sends, and assignments.
6. **Affiliation.** Lines & Logos and Authenticated, Inc. are not affiliated with Memphis-Shelby County Schools, DeSoto County Schools, or Bellevue Baptist Church; those organizations appear solely as sample/prospect context.

---

<div align="center">

**Lines & Logos** — Memphis, TN · Facilities, Surfaces, Branding

[Releases](https://github.com/ProjectZeroDays/Lines-And-Logos/releases) · [Issues](https://github.com/ProjectZeroDays/Lines-And-Logos/issues) · [Discussions](https://github.com/ProjectZeroDays/Lines-And-Logos/discussions)

*One vendor. One contract. One invoice.*

</div>
