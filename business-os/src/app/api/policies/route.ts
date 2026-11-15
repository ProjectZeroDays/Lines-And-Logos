import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const policies = await db.policy.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(policies);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const policy = await db.policy.create({ data: { title: body.title, content: body.content, category: body.category, status: body.status, author: body.author } });
    await db.activityLog.create({ data: { action: "policy_created", entity: "policy", entityId: policy.id, details: policy.title } });
    return NextResponse.json(policy);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}