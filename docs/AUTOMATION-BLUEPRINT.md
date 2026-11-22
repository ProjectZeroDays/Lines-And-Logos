# Lines & Logos — Business Automation Blueprint

**Intelligent, full automation of the business.** Source: 100+ Taskade-style automation prompts, mapped and tiered. This document is the strategic master plan; implementation status is tracked against the Business OS (`server.js`, zero-dep).

## Implementation status legend
- ✅ **Built** — live in the Business OS today
- 🟡 **Partial** — foundation exists, workflow incomplete
- ⬜ **Gap** — not yet automated

---

## Part 1 — Tier 1: Core Operations (all ✅)

| # | Automation | Status | Where |
| --- | --- | --- | --- |
| 1 | Service Business Hub (customers, jobs, invoices, team) | ✅ | dashboard + sales/ops/finance pages, one `data/db.json` |
| 2 | Job Dispatch & Scheduling | ✅ | ops dispatch board, crew assignment, calendar |
| 3 | Customer Status Updates (AI-drafted, approval-gated) | ✅ | outreach/approval flow, consent-gated comms |
| 4 | Sales CRM (leads → pipeline → follow-up) | ✅ | sales.html kanban, 25 real researched prospects |
| 5 | Lead Scoring (Hot/Warm/Cold + who-to-call-first) | ✅ | `GET /api/careers/signals`-style aggregates; tiers + scores per lead |
| 6 | Overdue Invoice Reminders (escalating, daily report) | ✅ | finance page + cron daily + spend audit |
| 7 | Invoicing System (projects → invoices → payments → reminders) | ✅ | invoices/payments/aging |
| 8 | Quote-to-Invoice Pipeline | ✅ | quotes.html → quote-request → estimate → invoice |
| 9 | Cash Flow Dashboard (revenue, expenses, runway, alerts) | ✅ | finance.html + `financialAlerts` |
| 10 | Revenue System (by service/client/season, churn flags) | ✅ | finance + spend-audit subscriptions |

## Part 2 — Tier 2: Sales & Marketing

| # | Automation | Status | Where |
| --- | --- | --- | --- |
| 11 | Account-Centered CRM | ✅ | contacts/accounts + per-account notes |
| 12 | Inbound Lead Intake (smart inbox, SLA) | ✅ | inquiries triage (`respondInquiry`), approval-gated |
| 13 | Lead Nurture Sequences | ✅ | drip/outreach engine + approvals |
| 14 | Lead Intelligence (enrichment) | ✅ | qualification loop — verified contacts, provenance per record |
| 15 | Competitor Watch | 🟡 | competitors collection exists; weekly scan loop not wired |
| 16 | Market Scan (bonds, capital campaigns, new construction) | ⬜ | gap — feeds the careers/signals pattern |
| 17 | Social Content Engine (repurpose → 7-day queue) | ✅ | social-media agent → approval queue → scheduled posts |
| 18 | Content Planning (editorial loop) | ✅ | marketing vault + campaigns |
| 19 | Blog Production | ✅ | `/api/blog` + right-rail feed |
| 20 | Newsletter System | ✅ | subscribers, sends, unsub |
| 21 | Landing Page | ✅ | index + quotes conversion flow |
| 22 | Portfolio Site | 🟡 | gallery + case studies exist; needs real photos |
| 23 | Lead Qualification Form | ✅ | instant scoring on apply/quote |
| 24 | Contact Intake | ✅ | inquiries + chat walkthrough capture |
| 25 | Email Triage | ✅ | inbox agent + memory bank notes per customer |

## Part 3 — Tier 3: Operations

| # | Automation | Status | Where |
| --- | --- | --- | --- |
| 26 | Daily Operations | ✅ | cron/daily: reminders, privacy sweep, spend audit, SEO, backups |
| 27 | Ops Checklists | ✅ | checklists + run records |
| 28 | Time Tracking | ✅ | timeEntries + payroll link |
| 29 | Smart Reminders | ✅ | followUps + notifications |
| 30 | Activity Log | ✅ | `db.activity` + agent audit trail |
| 31 | Vendor/Subcontractor Management | ✅ | vendors + terms + POs + dropship |
| 32 | Contract Review | 🟡 | contract records; AI risk-flag pass not wired |
| 33 | Document Analysis | ✅ | resume/RFP parsing, vault docs |
| 34 | Receipt Processing | 🟡 | expenses exist; email-to-expense not wired |
| 35 | Analytics Agent | ✅ | dashboards + SEO/spend audits |
| 36 | Weekly Reporting | 🟡 | live dashboards exist; auto-compiled weekly memo not built |
| 37 | Page Activity | ✅ | crmVisitors + chat analytics |

## Part 4 — Tier 4: HR & Team

| # | Automation | Status | Where |
| --- | --- | --- | --- |
| 38 | Employee Onboarding | ✅ | onboarding wizard + checklists |
| 39 | Recruiting CRM | ✅ | full ATS (apply → score → book → interview → offer → e-sign) |
| 40 | Resume Scoring | ✅ | scoreApplicant + AI polish |
| 41 | Employee Portal | ✅ | crew portal + ll_token scopes |
| 42 | Client Onboarding Portal | ✅ | customer.html v2 (auth, invoices, contracts, calendar) |
| 43 | Support Portal | ✅ | chat concierge + help/FAQ + wiki SOPs |
| 44 | Support Bot | ✅ | page-aware brain + walkthrough booking + SMS gating |

## Part 5 — Tier 5: Customer Experience

| # | Automation | Status | Where |
| --- | --- | --- | --- |
| 45 | Feedback Survey | ✅ | surveys + sentiment triage |
| 46 | Feedback Radar | 🟡 | reviews monitored; social-source scan not wired |
| 47 | Social Signals | ⬜ | gap (accounts not created yet — held by owner) |
| 48 | Appointment Booking | ✅ | candidate self-booking + chat walkthroughs + video meetings |
| 49 | Project Intake | ✅ | quote-request → scope → estimate |

## Part 6 — Tier 6: Compliance & Admin

| # | Automation | Status | Where |
| --- | --- | --- | --- |
| 50 | Team Wiki | ✅ | wiki SOPs + onboarding docs |
| 51 | Policy & Compliance | ✅ | policies register + audit log |
| 52 | Approvals Workflow | ✅ | approvalQueue + governance gate |
| 53 | Policy Generator | 🟡 | DocSyncAgent drafts; generator form not wired |
| 54 | Pricing Research | 🟡 | calculator + win/loss not wired |
| 55 | Pricing Calculator | ✅ | quotes.html engine |

## Part 2 (new prompts) — recommended additions

| # | Automation | Status |
| --- | --- | --- |
| A | Seasonal Capacity Planner | 🟡 dispatch exists; capacity calendar view gap |
| B | Grant & Funding Tracker | 🟡 filings/valuation exist; grant scan gap |
| C | Referral & Partner Management | ✅ full engine (attribution, commissions, payouts, dashboard) |
| D | QA & Photo Documentation | 🟡 photo curation + approval; AI completeness review gap |
| E | Safety & Compliance Tracking | 🟡 policies + insurance registers; incident log gap |
| F | Equipment & Asset Management | ⬜ gap |
| G | Client Success & Renewal Management | 🟡 CRM tiers; health-score/renewal loop gap |
| H | Proposal & Document Generator | 🟡 quote drafts; template library + win/loss gap |

---

## Dependency map (implemented)

Lead capture (landing → qualification → scoring → nurture) → Sales pipeline (CRM → quote-to-invoice → approvals) → Job delivery (dispatch → status updates → QA photos → time → invoice) → Finance (reminders → cash flow → revenue system → analytics) → Customer experience (portal → support bot → feedback → renewals) → HR (ATS → onboarding → employee portal). All wired through the central gate with governance on every agent action.

## Metrics targets (from the blueprint)

| Metric | Target | Today |
| --- | --- | --- |
| Lead response time | < 1 hr (Hot) | ✅ chat replies instantly; walkthroughs queue same-day |
| Invoice creation | < 2 min | ✅ auto from quote; Stripe checkout live |
| Overdue follow-up | 100% automated | ✅ escalating reminders + daily flags |
| Status updates | every change | ✅ consent-gated, AI-polished |
| Weekly reporting | 0 hours | 🟡 live dashboards; compiled memo pending |
| Lead scoring | instant | ✅ tier + score + provenance |

## Stack note

The blueprint's recommended SaaS stack (Taskade/HubSpot/QuickBooks/Twilio/Stripe/Calendly…) is largely **superseded by the Business OS itself**: the OS is the hub, CRM, invoicing, scheduling, portal, ATS, and governance layer in one zero-dependency process. External wiring remains for: production email/SMS (SMTP/Twilio), live Stripe keys (configured), QBO OAuth (pending), and the domain/host cutover.

*Living document — update as gaps close.*
