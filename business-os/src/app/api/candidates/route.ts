import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const candidates = await db.candidate.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(candidates);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidate = await db.candidate.create({ data: { name: body.name, email: body.email, phone: body.phone, role: body.role, source: body.source, notes: body.notes, stage: "applied" } });
    await db.activityLog.create({ data: { action: "candidate_created", entity: "candidate", entityId: candidate.id, details: candidate.name } });
    return NextResponse.json(candidate);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}