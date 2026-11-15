import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const contacts = await db.contact.findMany({ orderBy: { createdAt: "desc" }, include: { account: true } });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const contact = await db.contact.create({
      data: { name: body.name, role: body.role, email: body.email, phone: body.phone, accountId: body.accountId },
    });
    await db.activityLog.create({ data: { action: "contact_created", entity: "contact", entityId: contact.id, details: `Added contact: ${contact.name}` } });
    return NextResponse.json(contact);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}