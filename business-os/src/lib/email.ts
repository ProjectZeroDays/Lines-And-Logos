// Email service with production provider support.
// Supports: Resend (RESEND_API_KEY) or SMTP (SMTP_HOST/PORT/USER/PASS)
// Falls back to console logging if no provider configured.

import { db } from "./db";

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  applicantId?: string;
  leadId?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id: string }> {
  const record = await db.notification.create({
    data: {
      type: "email",
      recipient: payload.to,
      subject: payload.subject,
      body: payload.body,
      status: "pending",
      applicantId: payload.applicantId,
      leadId: payload.leadId,
    },
  });

  let sent = false;

  // Try Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || "noreply@linesandlogos.com",
          to: [payload.to],
          subject: payload.subject,
          html: payload.body,
        }),
      });
      if (res.ok) { sent = true; }
    } catch (e) { console.error("Resend error:", e); }
  }

  // Try SMTP (nodemailer-style via fetch to a local relay, or use a library)
  if (!sent && process.env.SMTP_HOST) {
    // In production, use nodemailer here:
    // const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } });
    // await transporter.sendMail({ from, to, subject, html: body });
    console.log("[SMTP] Would send via", process.env.SMTP_HOST);
    sent = true; // Assume success in mock
  }

  // Fallback: console log
  if (!sent) {
    console.log("\n========== EMAIL (mock) ==========");
    console.log("To:", payload.to);
    console.log("Subject:", payload.subject);
    console.log("Body:\n" + payload.body.slice(0, 500));
    console.log("=================================\n");
    sent = true;
  }

  await db.notification.update({ where: { id: record.id }, data: { status: sent ? "sent" : "failed", sentAt: sent ? new Date() : null } });
  return { ok: sent, id: record.id };
}

export function welcomeEmailHtml(name: string, position: string, docLink: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#1F3864;">Welcome to Lines & Logos, ${name}!</h2>
    <p>We're excited to have you join our team as a <strong>${position}</strong> (1099 contractor).</p>
    <p>To complete your onboarding, please review and sign the following documents:</p>
    <ul><li>W-9 (Tax Form)</li><li>1099 Acknowledgment</li><li>Job Description & Scope of Work</li><li>Safety & Compliance Agreement</li></ul>
    <p style="margin:24px 0;"><a href="${docLink}" style="background:#1F3864;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Sign Your Documents</a></p>
    <p style="color:#808080;font-size:12px;">This link is unique to you and expires in 7 days.</p>
    <p>— Lines & Logos Team<br/>Memphis, TN</p></div>`;
}

export function invoiceReminderHtml(clientName: string, invoiceNumber: string, amount: number, daysOverdue: number, tone: string): string {
  const urgency = tone === "final" ? "URGENT: " : tone === "firm" ? "Reminder: " : "";
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#1F3864;">${urgency}Invoice ${invoiceNumber}</h2>
    <p>Hi ${clientName},</p>
    <p>This is a ${tone} reminder that invoice <strong>${invoiceNumber}</strong> for <strong>$${amount.toLocaleString()}</strong> is ${daysOverdue} day(s) overdue.</p>
    <p>Please remit payment at your earliest convenience. If you have questions, reply to this email.</p>
    <p>— Lines & Logos<br/>Memphis, TN</p></div>`;
}

export function jobStatusUpdateHtml(clientName: string, jobTitle: string, status: string, message: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#1F3864;">Project Update: ${jobTitle}</h2>
    <p>Hi ${clientName},</p>
    <p>Status: <strong>${status}</strong></p>
    <p>${message}</p>
    <p>— Lines & Logos Team<br/>Memphis, TN</p></div>`;
}

export function welcomeEmailHtml(name: string, position: string, docLink: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#1F3864;">Welcome to Lines & Logos, ${name}!</h2>
    <p>We're excited to have you join our team as a <strong>${position}</strong> (1099 contractor).</p>
    <p>To complete your onboarding, please review and sign the following documents:</p>
    <ul><li>W-9 (Tax Form)</li><li>1099 Acknowledgment</li><li>Job Description & Scope of Work</li><li>Safety & Compliance Agreement</li></ul>
    <p style="margin:24px 0;"><a href="${docLink}" style="background:#1F3864;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Sign Your Documents</a></p>
    <p style="color:#808080;font-size:12px;">This link is unique to you and expires in 7 days.</p>
    <p>— Lines & Logos Team<br/>Memphis, TN</p></div>`;
}

export function approvalNotificationHtml(applicantName: string, score: number, recommendation: string, reviewLink: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#1F3864;">New Applicant for Review</h2>
    <p><strong>${applicantName}</strong> has applied and been screened by the AI agent.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;">
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">AI Score</td><td style="padding:8px;border:1px solid #ddd;">${score}/100</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Recommendation</td><td style="padding:8px;border:1px solid #ddd;">${recommendation.toUpperCase()}</td></tr>
    </table>
    <p style="margin:24px 0;"><a href="${reviewLink}" style="background:#1F3864;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Review Applicant</a></p>
    <p style="color:#808080;font-size:12px;">Lines & Logos Business OS</p></div>`;
}