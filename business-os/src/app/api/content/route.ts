import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const posts = await db.contentPost.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const post = await db.contentPost.create({
      data: { platform: body.platform, content: body.content, source: body.source, status: "draft", scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null },
    });
    await db.activityLog.create({ data: { action: "content_created", entity: "content", entityId: post.id, details: `${post.platform} post` } });
    return NextResponse.json(post);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}