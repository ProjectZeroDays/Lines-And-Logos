import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const expenses = await db.expense.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const expense = await db.expense.create({
      data: { category: body.category, amount: parseFloat(body.amount) || 0, description: body.description, vendor: body.vendor, date: body.date ? new Date(body.date) : new Date() },
    });
    await db.activityLog.create({ data: { action: "expense_created", entity: "expense", entityId: expense.id, details: `${expense.category}: $${expense.amount}` } });
    return NextResponse.json(expense);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}