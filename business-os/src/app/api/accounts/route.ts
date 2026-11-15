import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const accounts = await db.account.findMany({ orderBy: { updatedAt: "desc" }, include: { contacts: true, jobs: true, _count: { select: { leads: true, invoices: true } } } });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const account = await db.account.create({
      data: {
        name: body.name, type: body.type, segment: body.segment,
        seats: parseInt(body.seats) || 0, owner: body.owner,
        goals: body.goals, risks: body.risks,
        renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
      },
    });
    await db.activityLog.create({ data: { action: "account_created", entity: "account", entityId: account.id, details: `Created account: ${account.name}` } });
    return NextResponse.json(account);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}