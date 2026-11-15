import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, welcomeEmailHtml } from "@/lib/email";
import { sendSms, welcomeSms } from "@/lib/sms";
import { getDocTemplate, getAllDocTypes } from "@/lib/documents";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const applicant = await db.applicant.findUnique({ where: { id: params.id } });
    if (!applicant) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
    if (applicant.status === "approved" || applicant.status === "onboarded") {
      return NextResponse.json({ error: "Already approved" }, { status: 400 });
    }

    const { reason } = await req.json().catch(() => ({}));

    // Create employee record
    const employee = await db.employee.create({
      data: {
        applicantId: applicant.id,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        email: applicant.email,
        phone: applicant.phone,
        position: applicant.position,
        status: "active",
      },
    });

    // Create document records with secure tokens
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const vars = {
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      position: applicant.position,
      address: applicant.address || "",
      city: applicant.city || "",
      state: applicant.state || "",
      zip: applicant.zip || "",
      date: new Date().toLocaleDateString(),
    };

    const docLinks: string[] = [];
    for (const type of getAllDocTypes()) {
      const tmpl = getDocTemplate(type, vars);
      if (!tmpl) continue;
      const token = randomBytes(32).toString("hex");
      const doc = await db.document.create({
        data: {
          type: tmpl.type,
          title: tmpl.title,
          content: tmpl.content,
          applicantId: applicant.id,
          employeeId: employee.id,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
      docLinks.push(`${baseUrl}/portal/${token}`);
    }

    // The portal link uses the first document token; all docs are linked via employee
    // For simplicity, send a single portal link using the first doc token
    const portalToken = (await db.document.findFirst({ where: { employeeId: employee.id } }))?.token;
    const portalLink = `${baseUrl}/portal/${portalToken}`;

    // Send welcome email with document link
    await sendEmail({
      to: applicant.email,
      subject: "Welcome to Lines & Logos — Complete Your Onboarding",
      body: welcomeEmailHtml(applicant.firstName, applicant.position, portalLink),
      applicantId: applicant.id,
    });

    // Send welcome SMS
    await sendSms({
      to: applicant.phone,
      body: welcomeSms(applicant.firstName, portalLink),
      applicantId: applicant.id,
    });

    // Update applicant status
    await db.applicant.update({
      where: { id: applicant.id },
      data: {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: "admin",
      },
    });

    return NextResponse.json({
      message: `Approved ${applicant.firstName} ${applicant.lastName}. Employee record created. Welcome email + SMS sent with document signing link.`,
      employeeId: employee.id,
      portalLink,
    });
  } catch (err: any) {
    console.error("Approve error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}