import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { signature } = await req.json();
    if (!signature || typeof signature !== "string" || signature.trim().length < 2) return NextResponse.json({ error: "Signature required" }, { status: 400 });

    const doc = await db.document.findUnique({ where: { token: params.token }, include: { employee: { include: { documents: true } } } });
    if (!doc) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
    if (doc.signed) return NextResponse.json({ error: "Already signed" }, { status: 400 });
    if (doc.expiresAt && new Date() > doc.expiresAt) return NextResponse.json({ error: "Link expired" }, { status: 410 });

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";

    await db.document.update({ where: { id: doc.id }, data: { signed: true, signedAt: new Date(), signature: signature.trim(), ipAddress: ip, userAgent: ua } });

    const emp = doc.employee;
    if (emp) {
      const updates: any = {};
      if (doc.type === "w9") { updates.w9Signed = true; updates.w9SignedAt = new Date(); }
      if (doc.type === "ack1099") { updates.ack1099Signed = true; updates.ack1099SignedAt = new Date(); }
      if (doc.type === "jobdesc") { updates.jobDescSigned = true; updates.jobDescSignedAt = new Date(); }
      if (doc.type === "safety") { updates.safetySigned = true; updates.safetySignedAt = new Date(); }
      await db.employee.update({ where: { id: emp.id }, data: updates });

      const allDocs = await db.document.findMany({ where: { employeeId: emp.id } });
      const allSigned = allDocs.every((d) => d.id === doc.id ? true : d.signed);
      if (allSigned) {
        await db.employee.update({ where: { id: emp.id }, data: { allDocsSigned: true, allDocsSignedAt: new Date() } });
        if (emp.applicantId) await db.applicant.update({ where: { id: emp.applicantId }, data: { status: "onboarded" } });

        const adminEmail = process.env.ADMIN_EMAIL || "admin@linesandlogos.com";
        await sendEmail({ to: adminEmail, subject: `Onboarding Complete: ${emp.firstName} ${emp.lastName}`, body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#2e7d32;">Onboarding Complete</h2><p><strong>${emp.firstName} ${emp.lastName}</strong> has signed all onboarding documents.</p><p>Position: ${emp.position}</p><p>Email: ${emp.email} | Phone: ${emp.phone || "N/A"}</p><p>All documents signed and stored.</p><p>— Lines & Logos Business OS</p></div>` });
        await sendEmail({ to: emp.email, subject: "Your Signed Onboarding Documents — Lines & Logos", body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#1F3864;">Onboarding Complete!</h2><p>Hi ${emp.firstName},</p><p>You've successfully signed all your onboarding documents. Copies are stored in our system.</p><p><strong>Documents completed:</strong></p><ul><li>W-9 (Tax Form)</li><li>1099 Acknowledgment</li><li>Job Description & Scope of Work</li><li>Safety & Compliance Agreement</li></ul><p>Welcome to the team!</p><p>— Lines & Logos Team</p></div>` });
      }
    }

    return NextResponse.json({ message: "Document signed successfully", allSigned: doc.employee ? (await db.employee.findUnique({ where: { id: doc.employee.id } }))?.allDocsSigned : false });
  } catch (err: any) {
    console.error("Sign error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}