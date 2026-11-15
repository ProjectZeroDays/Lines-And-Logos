import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const vendors = await db.vendor.findMany({ orderBy: { createdAt: "desc" }, include: { purchaseOrders: true } });
  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vendor = await db.vendor.create({ data: { name: body.name, category: body.category, contact: body.contact, email: body.email, phone: body.phone, notes: body.notes } });
    await db.activityLog.create({ data: { action: "vendor_created", entity: "vendor", entityId: vendor.id, details: vendor.name } });
    return NextResponse.json(vendor);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}