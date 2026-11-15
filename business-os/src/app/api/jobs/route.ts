import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobDispatchAgent } from "@/lib/ai-agents";

export async function GET() {
  const jobs = await db.job.findMany({ orderBy: { updatedAt: "desc" }, include: { account: true } });
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const job = await db.job.create({
      data: {
        title: body.title, type: body.type, status: "quoted",
        accountId: body.accountId || null, assignedTo: body.assignedTo || null,
        crewDays: parseInt(body.crewDays) || null,
        value: parseFloat(body.value) || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        notes: body.notes,
      },
    });
    await db.activityLog.create({ data: { action: "job_created", entity: "job", entityId: job.id, details: `Created job: ${job.title} (${job.type})` } });
    return NextResponse.json(job);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}