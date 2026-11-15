import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const entries = await db.timeEntry.findMany({ orderBy: { date: "desc" }, include: { job: true } });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = await db.timeEntry.create({
      data: { jobId: body.jobId, worker: body.worker, hours: parseFloat(body.hours) || 0, date: body.date ? new Date(body.date) : new Date(), billable: !!body.billable, notes: body.notes },
    });
    await db.activityLog.create({ data: { action: "time_logged", entity: "time_entry", entityId: entry.id, details: `${entry.worker}: ${entry.hours}h` } });
    return NextResponse.json(entry);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}