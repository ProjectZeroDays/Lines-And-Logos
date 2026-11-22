# Go-To-Market Playbook — Tier 1

The working kit lives in **`/mnt/agents/output/Tier1-GTM-Spreadsheet.xlsx`** (6 sheets, live formulas). This page is the map.

## Sheet map
| Sheet | What it is |
| --- | --- |
| **Accounts** | 28 rows — 25 verified Tier-1 accounts from the research loop (named facilities contacts, phones, emails, distances, provenance) + 3 template rows. Fit Score, Budget Gate, and Priority Tier are **live Excel formulas**. |
| **Scoring** | Weighted 0-100 calculator: Facility 20% · Services Gap 20% · Budget 25% (GATED — <2 caps at 49) · Access 20% · Timing 15%. A ≥75 · B 55–74 · C <55. |
| **Bundles** | Gym Refresh / Campus Branding / Full Facility / Maintenance Plan — anchor pricing straight from the live calculator, with the margin story. |
| **Competitive Intel** | Sports Floors Inc. (Memphis, floors-only, Connor distributor, **our target list is their client list**), Finchum (East TN, floors/tracks), GameDay (poured seamless — flagged not-local), Conrad & Martin (unverified, follow-up required). Wedge: bundled scope rivals must subcontract. |
| **Sequences** | 4-touch outreach per segment, timed to budget cycles: districts (bonds/summer windows, contact Nov–Feb), churches (stewardship campaigns/anniversaries), parks (fiscal-year/grant cycles). |
| **Business Plan** | 10-section outline specific to the Memphis athletic flooring + graphics market. |

## Operating rules
1. **Fill Facility Count + Budget Capacity last** — they need live research (district enrollment, campaign size). The gate formula protects you from chasing no-budget accounts.
2. **Timing beats script.** A B-tier account in its budget window outranks an A-tier account that just closed its cycle.
3. Every outreach references the bundle, never a single service — that's the whole wedge.
4. Feed wins/losses back via `POST /api/market-intel`; the Claw `market-scan` job type supplies new bond/campaign intel.
5. Re-score quarterly — the Accounts sheet is a living document.
