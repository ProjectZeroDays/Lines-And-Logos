import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { screenApplicant } from "@/lib/ai-screening";
import { sendEmail, approvalNotificationHtml } from "@/lib/email";
import { sendSms } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, address, city, state, zip, position, experience, skills, availability, hasTransport, hasInsurance, coverLetter, references } = body;
    if (!firstName || !lastName || !email || !phone || !position) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const existing = await db.applicant.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "An application with this email already exists" }, { status: 409 });

    const screening = screenApplicant({ position, experience: experience || "0", skills: skills || "", availability: availability || "", hasTransport: !!hasTransport, hasInsurance: !!hasInsurance, coverLetter: coverLetter || "", references: references || "" });

    const applicant = await db.applicant.create({
      data: { firstName, lastName, email, phone, address, city, state, zip, position, experience: experience || "0", skills, availability, hasTransport: !!hasTransport, hasInsurance: !!hasInsurance, coverLetter, references, aiScore: screening.score, aiSummary: screening.summary, aiRecommendation: screening.recommendation, status: "screening", screenedAt: new Date() },
    });

    const adminEmail = process.env.ADMIN_EMAIL || "admin@linesandlogos.com";
    const reviewLink = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"}/admin/applicants/${applicant.id}`;
    await sendEmail({ to: adminEmail, subject: `New Applicant: ${firstName} ${lastName} — ${position} (AI Score: ${screening.score}/100)`, body: approvalNotificationHtml(`${firstName} ${lastName}`, screening.score, screening.recommendation, reviewLink), applicantId: applicant.id });

    await db.activityLog.create({ data: { action: "application_submitted", entity: "applicant", entityId: applicant.id, details: `AI Score: ${screening.score}/100 (${screening.recommendation})` } });

    return NextResponse.json({ applicantId: applicant.id, aiScore: screening.score, recommendation: screening.recommendation, summary: screening.summary });
  } catch (err: any) {
    console.error("Apply error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}