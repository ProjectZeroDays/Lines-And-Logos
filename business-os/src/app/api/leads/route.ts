import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leadScoreAgent } from "@/lib/ai-agents";

export async function GET() {
  const leads = await db.lead.findMany({ orderBy: [{ score: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const screening = leadScoreAgent({ company: body.company, type: body.type, source: body.source, notes: body.notes });
    const lead = await db.lead.create({
      data: {
        name: body.name, company: body.company, email: body.email, phone: body.phone,
        source: body.source, type: body.type, notes: body.notes,
        score: screening.score, tier: screening.tier, aiSummary: screening.summary,
        stage: "new",
      },
    });
    // Notify if hot
    if (screening.tier === "hot") {
      await db.notification.create({
        data: { type: "app", recipient: "admin", subject: `Hot Lead: ${body.name}`, body: screening.summary, status: "sent", sentAt: new Date() },
      });
    }
    await db.activityLog.create({ data: { action: "lead_created", entity: "lead", entityId: lead.id, details: screening.summary } });
    return NextResponse.json(lead);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}