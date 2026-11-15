import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const checklists = await db.checklist.findMany({ include: { runs: true } });
  return NextResponse.json(checklists);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = body.items.split("\n").filter((i: string) => i.trim()).map((i: string) => ({ text: i.trim(), done: false }));
    const checklist = await db.checklist.create({ data: { name: body.name, type: body.type, items: JSON.stringify(items) } });
    await db.activityLog.create({ data: { action: "checklist_created", entity: "checklist", entityId: checklist.id, details: checklist.name } });
    return NextResponse.json(checklist);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}