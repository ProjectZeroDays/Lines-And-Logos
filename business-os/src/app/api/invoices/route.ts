import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const invoices = await db.invoice.findMany({ orderBy: { createdAt: "desc" }, include: { account: true, job: true, payments: true } });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const invoice = await db.invoice.create({
      data: {
        number: body.number, amount: parseFloat(body.amount) || 0, status: "draft",
        accountId: body.accountId || null, jobId: body.jobId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null, notes: body.notes,
      },
    });
    await db.activityLog.create({ data: { action: "invoice_created", entity: "invoice", entityId: invoice.id, details: `Created invoice ${invoice.number} for $${invoice.amount}` } });
    return NextResponse.json(invoice);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}