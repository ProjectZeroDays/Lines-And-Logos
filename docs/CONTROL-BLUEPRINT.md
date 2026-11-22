# Control Blueprint — every dashboard surface, every control

How each page is laid out, what each control does, and what we'd add next. Canonical layout: **sidebar navigation** (12 sections, active = gradient pill) → **topbar** (view title, search, actions) → **content** (KPI strip → panels → tables). Every page is gated by the central auth gate (staff token; role-checked per route).

## Global chrome
| Control | Function |
| --- | --- |
| Sidebar sections | Dashboard · Sales · Ops · Field · Finance · Team · Marketing · Onboarding · Admin · Settings + section pills (Payroll/Hiring under Team; Integrations/Wiki/Policies/Notifications/Governance/Memory/Kimi Claw under Admin) |
| Topbar search | Filters tables/lists in the current view |
| Theme | Light/dark token swap (IONOS light / Bluehost dark) |
| Notifications bell | Unread items from `db.notifications` (admin) |
| Toasts | Action confirmations (bottom-right, auto-dismiss) |
| Kill-switch | Master + per-agent toggles (Admin → Governance); 423-blocks every `/api/agent/*` POST |

## Dashboard (`dashboard.html`)
**KPIs:** pipeline value, active jobs, outstanding AR, MRR-style revenue · **panels:** pipeline funnel, agent activity feed, finance snapshot, upcoming events, recent activity.
*Add:* capacity gauge (`/api/capacity`), weekly memo card (`/api/weekly-memo`), health-score alerts (`/api/health-scores` at-risk rows).

## Sales (`sales.html`)
**Controls:** pipeline kanban (lead cards drag between stages), lead table (score, tier, next-step, verified badge), prospect scout run button, outreach approval queue, follow-up list.
**API:** `GET/POST/PATCH /api/leads`, `POST /api/agent/prospect`, `GET/POST /api/approvals`.
*Add:* win/loss panel (`/api/winloss`), bulk import, map view of lead cities.

## Ops (`ops.html`)
**Controls:** dispatch board (job → crew assignment + scheduled date), calendar strip, job cards with status pills, checklist runner, incident logger (new: `POST /api/incidents`).
**API:** `/api/jobs`, `/api/employees`, `/api/incidents`, `/api/capacity`.
*Add:* capacity heatmap (overbooked days highlighted), equipment assignment picker (new: `/api/equipment`).

## Field (`field.html`)
**Controls:** consent-gated crew location map (work hours only), check-in/out feed, trip planner.
*Add:* equipment checkout status per crew, safety-score per site.

## Finance (`finance.html`)
**Controls:** AR aging, invoice list → pay/void, expense capture, spend-audit flags (subscriptions/duplicates/anomalies), tax due-date reminders, valuation snapshot.
**API:** `/api/invoices`, `/api/payments`, `/api/spend-audit`, `/api/stripe/*`.
*Add:* receipt inbox (email → expense), cash-flow forecast line.

## Team (`team.html` → payroll/hiring pills)
**Controls:** employee roster, payroll run builder (approve → pay), applicant pipeline (ATS), hire-packet issuance, referral list.
**API:** `/api/employees`, `/api/payroll/*`, `/api/applicants/*`, `/api/referrals`.
*Add:* time-off requests, certification expiry alerts (link to equipment/policies).

## Marketing (`marketing.html`)
**Controls:** campaigns (budget/channel/ROI), newsletter composer + sends, social queue (draft → approve → schedule), SEO audit score, blog posts, gallery approval queue.
**API:** `/api/campaigns`, `/api/newsletter/*`, `/api/seo/audit`, `/api/blog`, `/api/gallery`.
*Add:* social-signals panel (when accounts exist), competitor-watch digest (feed `/api/market-intel`).

## Onboarding (`onboarding.html`)
**Controls:** wizard (client/job/employee), progress steps, launch checklist, owner-handoff dossier.
*Add:* template library (scope/checklist presets per service type).

## Admin (`admin.html`) — 17 tabs
| Tab | Controls |
| --- | --- |
| AI Agents | 31 agent cards (tier, auto badge, run button, output panel) |
| Customers · CRM | account list, per-account notes, KYC status |
| Employees | roster editor, roles, availability |
| Field Map | live consent-gated map (read-only here) |
| Payroll | runs, bulk payout, tax table |
| Hiring | ATS kanban, resume download, status pipeline |
| Affiliates | partner list, codes, ledger links |
| Approvals | queue (approve/reject with note), money-gated separately |
| Integrations | Stripe, Google suite, QBO stubs, webhook config |
| Wiki / Policies | SOP docs, policy register, generator entry |
| Notifications | broadcast composer, per-role targeting |
| Governance | master switch, per-agent tier/cap/kill, eval harness, audit trail |
| Memory | memory-bank browser (add/delete, sources) |
| Kimi Claw | repo config, coding-job queue (feature/patch/docs/github/release/seo/dependency), schedules |
| Settings | company, tax table, delivery, AI providers panel (BYOK), local model panel, routing |

## Settings (`settings.html`)
Company profile, tax jurisdictions, AI provider keys (masked), usage ledger, routing table, local model manager (`llama-server`).

## Public-side controls
Quotes calculator (service/sqft/city → live lines), careers apply (multipart + consents + self-booking), customer portal (9 views, auth + 2FA + passkeys), partner dashboard (link/code copy, pipeline, commissions, payout eligibility), chat dock (page-aware, walkthrough booking, SMS-consent gate).

## Conventions
- Every destructive action asks confirmation; every mutation toasts; every list paginates (cursor where large).
- All agent outputs that touch money/customers go through the approval queue.
- New controls: add API → COLL/route → view function → Playwright check (desktop+mobile).
