import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Sample accounts
  const mscs = await db.account.create({ data: { name: "Memphis-Shelby County Schools", type: "school-district", segment: "enterprise", seats: 213, owner: "admin", goals: "Gym refresh + campus branding", health: "green" } });
  const desoto = await db.account.create({ data: { name: "DeSoto County School District", type: "school-district", segment: "enterprise", seats: 42, owner: "admin", goals: "Gym refresh (pilot)", health: "green" } });
  const bellevue = await db.account.create({ data: { name: "Bellevue Baptist Church", type: "church", segment: "mid-market", seats: 3, owner: "admin", goals: "Donor wall + campus branding", health: "yellow" } });

  // Sample leads
  await db.lead.create({ data: { name: "Dr. Roderick Richmond", company: "Memphis-Shelby County Schools", email: "superintendent@scsk12.org", phone: "(901) 416-5300", source: "cold-outreach", type: "school-district", score: 92, tier: "hot", stage: "contacted", notes: "Grizzlies Dream Court; Pathway to Greatness; 213 campuses" } });
  await db.lead.create({ data: { name: "Superintendent", company: "DeSoto County School District", email: "info@desotocountyschools.org", phone: "(662) 429-5271", source: "cold-outreach", type: "school-district", score: 80, tier: "hot", stage: "new", notes: "#BeTheStandard; 42 campuses; 25 mi from Memphis" } });

  // Sample job
  await db.job.create({ data: { title: "MSCS - Northeast Prep gym refresh", type: "gym-refresh", status: "quoted", accountId: mscs.id, value: 15000, crewDays: 5 } });

  // Sample invoice
  await db.invoice.create({ data: { number: "L&L-2026-001", amount: 15000, status: "sent", accountId: mscs.id, dueDate: new Date("2026-12-15") } });

  // Sample expense
  await db.expense.create({ data: { category: "materials", amount: 2500, description: "Floor finish + paint", vendor: "Sherwin-Williams" } });

  // Sample revenue
  await db.revenue.create({ data: { source: "project", amount: 15000, accountId: mscs.id } });

  // Sample tasks
  await db.task.create({ data: { title: "Follow up with MSCS (Dr. Richmond)", owner: "admin", priority: "high", status: "pending", dueDate: new Date("2026-11-20") } });
  await db.task.create({ data: { title: "Schedule DeSoto walkthrough", owner: "admin", priority: "high", status: "pending", dueDate: new Date("2026-11-22") } });
  await db.task.create({ data: { title: "Register as vendor - MSCS Procurement", owner: "admin", priority: "medium", status: "pending" } });

  // Sample checklist
  await db.checklist.create({ data: { name: "Pre-Job Safety Checklist", type: "safety", items: JSON.stringify([{ text: "Verify COI on file", done: false }, { text: "Background check clearance", done: false }, { text: "SDS sheets on-site", done: false }, { text: "PPE available", done: false }, { text: "Client access confirmed", done: false }]) } });

  // Sample wiki doc
  await db.wikiDoc.create({ data: { title: "Gym Floor Refinishing SOP", content: "1. Assess floor condition\n2. Moisture test\n3. Sand to bare wood\n4. Apply sealer\n5. Apply 2-3 coats finish\n6. Restripe\n7. Paint center-court logo\n8. Final inspection", category: "sop", status: "published", author: "admin" } });

  // Sample policy
  await db.policy.create({ data: { title: "Safety Policy - OSHA Compliance", content: "All crew members must follow OSHA standards, wear PPE, and report incidents within 24 hours.", category: "safety", status: "published", author: "admin" } });

  // Sample content post
  await db.contentPost.create({ data: { platform: "linkedin", content: "We're Lines & Logos — one vendor, one contract, one invoice for your entire facility. Gym floors, wall wraps, signage, donor walls, parking lots, playgrounds. Memphis-based, Mid-South wide.", status: "draft", source: "manual" } });

  // Sample notification
  await db.notification.create({ data: { type: "app", recipient: "admin", subject: "Welcome to Business OS", body: "Your business automation platform is ready. Start by reviewing the Dashboard.", status: "sent", sentAt: new Date() } });

  console.log("Seeded Business OS with sample data");
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); db.$disconnect(); process.exit(1); });
