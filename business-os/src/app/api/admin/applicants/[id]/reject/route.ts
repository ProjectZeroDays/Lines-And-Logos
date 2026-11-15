import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const applicant = await db.applicant.findUnique({ where: { id: params.id } });
    if (!applicant) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });

    const { reason } = await req.json().catch(() => ({}));
    const rejectionReason = reason || "Not a fit at this time";

    await db.applicant.update({ where: { id: applicant.id }, data: { status: "rejected", rejectedAt: new Date(), rejectedReason: rejectionReason } });

    await sendEmail({ to: applicant.email, subject: "Update on Your Application — Lines & Logos", body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#1F3864;">Thank You for Applying</h2><p>Hi ${applicant.firstName},</p><p>Thank you for your interest in contracting with Lines & Logos. After reviewing your application, we've decided not to move forward at this time.</p><p>Reason: ${rejectionReason}</p><p>We appreciate your time and encourage you to apply again in the future.</p><p>— Lines & Logos Team</p></div>`, applicantId: applicant.id });

    await db.activityLog.create({ data: { action: "applicant_rejected", entity: "applicant", entityId: applicant.id, details: rejectionReason } });

    return NextResponse.json({ message: `Rejected ${applicant.firstName} ${applicant.lastName}.` });
  } catch (err: any) {
    console.error("Reject error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}