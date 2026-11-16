import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, welcomeEmailHtml } from "@/lib/email";
import { sendSms, welcomeSms } from "@/lib/sms";
import { getDocTemplate, getAllDocTypes } from "@/lib/documents";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const applicant = await db.applicant.findUnique({ where: { id } });
    if (!applicant) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
    if (applicant.status === "approved" || applicant.status === "onboarded") return NextResponse.json({ error: "Already approved" }, { status: 400 });

    await req.json().catch(() => ({}));

    const employee = await db.employee.create({
      data: { applicantId: applicant.id, name: `${applicant.firstName} ${applicant.lastName}`, email: applicant.email, phone: applicant.phone, role: applicant.position, status: "active" },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";
    const vars = { firstName: applicant.firstName, lastName: applicant.lastName, position: applicant.position, address: applicant.address || "", city: applicant.city || "", state: applicant.state || "", zip: applicant.zip || "", date: new Date().toLocaleDateString() };

    for (const type of getAllDocTypes()) {
      const tmpl = getDocTemplate(type, vars);
      if (!tmpl) continue;
      const token = randomBytes(32).toString("hex");
      await db.document.create({ data: { type: tmpl.type, title: tmpl.title, content: tmpl.content, applicantId: applicant.id, employeeId: employee.id, token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    }

    const portalToken = (await db.document.findFirst({ where: { employeeId: employee.id } }))?.token;
    const portalLink = `${baseUrl}/portal/${portalToken}`;

    await sendEmail({ to: applicant.email, subject: "Welcome to Lines & Logos — Complete Your Onboarding", body: welcomeEmailHtml(applicant.firstName, applicant.position, portalLink), applicantId: applicant.id });
    await sendSms({ to: applicant.phone, body: welcomeSms(applicant.firstName, portalLink), applicantId: applicant.id });

    await db.applicant.update({ where: { id: applicant.id }, data: { status: "approved", approvedAt: new Date(), approvedBy: "admin" } });

    await db.activityLog.create({ data: { action: "applicant_approved", entity: "applicant", entityId: applicant.id, details: `Approved ${applicant.firstName} ${applicant.lastName}. Employee: ${employee.id}` } });

    return NextResponse.json({ message: `Approved ${applicant.firstName} ${applicant.lastName}. Welcome email + SMS sent.`, employeeId: employee.id, portalLink });
  } catch (err: any) {
    console.error("Approve error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}