import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const employees = await db.employee.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const employee = await db.employee.create({ data: { name: body.name, email: body.email, phone: body.phone, role: body.role, team: body.team, timezone: body.timezone } });
    await db.activityLog.create({ data: { action: "employee_created", entity: "employee", entityId: employee.id, details: employee.name } });
    return NextResponse.json(employee);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}