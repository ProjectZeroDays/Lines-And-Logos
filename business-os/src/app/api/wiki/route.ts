import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const docs = await db.wikiDoc.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const doc = await db.wikiDoc.create({ data: { title: body.title, content: body.content, category: body.category, status: body.status, author: body.author } });
    await db.activityLog.create({ data: { action: "wiki_created", entity: "wiki", entityId: doc.id, details: doc.title } });
    return NextResponse.json(doc);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}