import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const revenue = await db.revenue.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(revenue);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rev = await db.revenue.create({
      data: { source: body.source, amount: parseFloat(body.amount) || 0, date: body.date ? new Date(body.date) : new Date(), accountId: body.accountId || null, jobId: body.jobId || null },
    });
    await db.activityLog.create({ data: { action: "revenue_created", entity: "revenue", entityId: rev.id, details: `${rev.source}: $${rev.amount}` } });
    return NextResponse.json(rev);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}