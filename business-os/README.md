# Lines & Logos — Business OS

Complete business automation platform for a Memphis-based facility branding & athletic surface company. Implements 60+ automated workflows covering sales, marketing, operations, finance, HR, customer experience, and compliance.

## Tech Stack
- Next.js 14 (App Router)
- Prisma + SQLite (swap to PostgreSQL for production)
- TypeScript
- AI Agents (OpenAI/Claude with heuristic fallback)

## Setup
```bash
cd business-os
npm install
cp .env.example .env.local
npx prisma db push
npm run db:seed
npm run dev
```
Open http://localhost:3001

## Modules (35+ pages)
- **Dashboard** — Daily ops brief, KPIs, recent activity, account health
- **Sales** — Leads (AI scoring), Accounts (health scoring), Pipeline/Quotes, Contacts
- **Operations** — Jobs, Schedule, Invoices, Time Tracking, Checklists
- **Finance** — Cash Flow, Expenses, Revenue
- **Marketing** — Marketing Hub, Content Queue, Social Media, Campaigns, Landing Page
- **Team** — Employees, Contractors, Vendors, Recruiting
- **Clients** — Client Portal, Support, Feedback
- **Admin** — Wiki, Policies, Approvals, Reports, Settings

## AI Agents
1. Lead Score Agent — scores leads 0-100 (hot/warm/cold)
2. Job Dispatch Agent — matches jobs to contractors by skills
3. Invoice Reminder Agent — escalating reminders (friendly/firm/final)
4. Health Score Agent — account health (green/yellow/red) with risks
5. Competitor Watch Agent — analyzes competitor changes
6. Daily Ops Agent — generates daily operations brief
7. Job Status Update Agent — drafts customer updates (LLM-powered)
8. Content Repurposing Agent — repurposes content for social media
9. Competitor Analysis Agent — competitive impact analysis

## Cron Jobs
- `GET /api/cron/daily` — Daily ops brief, overdue invoice reminders, task overdue check, account health update
- `GET /api/cron/weekly` — Weekly report email, competitor watch, market scan, content planning

Set up Vercel Cron or GitHub Actions to hit these endpoints.

## Production Integrations
See `.env.example` for all configuration options:
- **Email**: Resend (RESEND_API_KEY) or SMTP (SMTP_HOST/PORT/USER/PASS)
- **SMS**: Twilio (TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER)
- **AI**: OpenAI (OPENAI_API_KEY) or Anthropic (ANTHROPIC_API_KEY)
- **Payments**: Stripe (STRIPE_SECRET_KEY)
- **Database**: Swap SQLite for PostgreSQL in schema.prisma
- **Auth**: Add NextAuth/Clerk
- **Files**: S3/Vercel Blob for uploads
- **E-Signatures**: DocuSign/HelloSign
- **Calendar**: Calendly/Cal.com

## Automation Coverage
- **60+ automations** across 6 tiers (Core Ops, Sales, Operations, HR, Customer Experience, Compliance)
- **Dependency map** showing how automations connect
- **ROI projection**: 44 hours/week saved = ~$115,000/year
- See `Business_Automation_Blueprint.md` for full details
