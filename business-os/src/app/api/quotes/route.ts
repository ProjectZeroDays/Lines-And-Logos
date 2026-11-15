import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const opps = await db.opportunity.findMany({ orderBy: { createdAt: "desc" }, include: { account: true } });
  return NextResponse.json(opps);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const opp = await db.opportunity.create({
      data: { type: body.type, value: parseFloat(body.value) || 0, accountId: body.accountId || null, closeDate: body.closeDate ? new Date(body.closeDate) : null, notes: body.notes, stage: "prospect" },
    });
    await db.activityLog.create({ data: { action: "quote_created", entity: "opportunity", entityId: opp.id, details: `${opp.type}: $${opp.value}` } });
    return NextResponse.json(opp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}