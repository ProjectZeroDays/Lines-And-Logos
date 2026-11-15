import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Admin user
  await db.adminUser.upsert({
    where: { email: "admin@linesandlogos.com" },
    update: {},
    create: { email: "admin@linesandlogos.com", name: "Admin", role: "admin" },
  });

  // Job postings
  const jobs = [
    { title: "Floor Installer", description: "Hardwood gym floor sanding, finishing, and refinishing.", requirements: "2+ yrs flooring experience, reliable transport, GL insurance", payRate: "$25-35/hr", location: "Memphis metro + Mid-South" },
    { title: "Court Striping Technician", description: "Basketball, volleyball, pickleball line painting.", requirements: "1+ yr painting/striping, reliable transport", payRate: "$20-28/hr", location: "Memphis metro + Mid-South" },
    { title: "Vinyl/Graphics Installer", description: "Wall wraps, window graphics, decals, signage.", requirements: "1+ yr vinyl install, reliable transport", payRate: "$22-32/hr", location: "Memphis metro + Mid-South" },
    { title: "Mural Painter", description: "Custom murals for gyms, hallways, cafeterias.", requirements: "2+ yrs mural/fine art, portfolio", payRate: "$30-45/hr", location: "Memphis metro + Mid-South" },
    { title: "General Laborer", description: "Support crew: prep, cleanup, material handling.", requirements: "Entry-level, reliable transport", payRate: "$15-20/hr", location: "Memphis metro + Mid-South" },
    { title: "Project Coordinator", description: "Schedule crews, manage clients, site visits.", requirements: "Admin + field experience, driver's license", payRate: "$22-30/hr", location: "Memphis metro" },
  ];
  for (const j of jobs) {
    await db.jobPosting.create({ data: j });
  }
  console.log("Seeded admin user + 6 job postings");
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); db.$disconnect(); process.exit(1); });
