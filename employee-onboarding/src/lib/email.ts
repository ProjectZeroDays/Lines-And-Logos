// Email service. Mock implementation stores messages in DB + console.
// To use real email, set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS or RESEND_API_KEY
// and replace the `sendEmail` body with nodemailer/resend calls.

import { db } from "./db";

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  applicantId?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id: string }> {
  const record = await db.notification.create({
    data: {
      type: "email",
      recipient: payload.to,
      subject: payload.subject,
      body: payload.body,
      status: "sent",
      sentAt: new Date(),
      applicantId: payload.applicantId,
    },
  });

  // Mock: log to console (replace with nodemailer/resend in production)
  console.log("\n========== EMAIL SENT ==========");
  console.log("To:", payload.to);
  console.log("Subject:", payload.subject);
  console.log("Body:\n" + payload.body);
  console.log("================================\n");

  // TODO: Production implementation:
  // const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, ... });
  // await transporter.sendMail({ from: process.env.FROM_EMAIL, to: payload.to, subject: payload.subject, html: payload.body });

  return { ok: true, id: record.id };
}

export function welcomeEmailHtml(name: string, position: string, docLink: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#1F3864;">Welcome to Lines & Logos, ${name}!</h2>
      <p>We're excited to have you join our team as a <strong>${position}</strong> (1099 contractor).</p>
      <p>To complete your onboarding, please review and sign the following documents:</p>
      <ul>
        <li>W-9 (Tax Form)</li>
        <li>1099 Acknowledgment</li>
        <li>Job Description & Scope of Work</li>
        <li>Safety & Compliance Agreement</li>
      </ul>
      <p style="margin:24px 0;">
        <a href="${docLink}" style="background:#1F3864;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
          Sign Your Documents
        </a>
      </p>
      <p style="color:#808080;font-size:12px;">This link is unique to you and expires in 7 days. If you have questions, reply to this email.</p>
      <p>— Lines & Logos Team<br/>Memphis, TN</p>
    </div>
  `;
}

export function approvalNotificationHtml(applicantName: string, score: number, recommendation: string, reviewLink: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#1F3864;">New Applicant for Review</h2>
      <p><strong>${applicantName}</strong> has applied and been screened by the AI agent.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">AI Score</td><td style="padding:8px;border:1px solid #ddd;">${score}/100</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Recommendation</td><td style="padding:8px;border:1px solid #ddd;">${recommendation.toUpperCase()}</td></tr>
      </table>
      <p style="margin:24px 0;">
        <a href="${reviewLink}" style="background:#1F3864;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
          Review Applicant
        </a>
      </p>
      <p style="color:#808080;font-size:12px;">Lines & Logos Employee Onboarding System</p>
    </div>
  `;
}
