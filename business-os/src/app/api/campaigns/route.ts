import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const campaign = await db.campaign.create({
      data: { name: body.name, type: body.type, status: body.status, spend: parseFloat(body.spend) || 0, startDate: body.startDate ? new Date(body.startDate) : null, endDate: body.endDate ? new Date(body.endDate) : null },
    });
    await db.activityLog.create({ data: { action: "campaign_created", entity: "campaign", entityId: campaign.id, details: campaign.name } });
    return NextResponse.json(campaign);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}