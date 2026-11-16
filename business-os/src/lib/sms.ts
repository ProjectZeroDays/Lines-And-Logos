// SMS service with Twilio support (env vars) + console fallback.

import { db } from "./db";

export interface SmsPayload { to: string; body: string; leadId?: string; jobId?: string; applicantId?: string; }

export async function sendSms(payload: SmsPayload): Promise<{ ok: boolean; id: string }> {
  const record = await db.notification.create({
    data: { type: "sms", recipient: payload.to, body: payload.body, status: "pending", leadId: payload.leadId, jobId: payload.jobId, applicantId: payload.applicantId },
  });

  let sent = false;

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: payload.to, From: process.env.TWILIO_FROM_NUMBER, Body: payload.body }).toString(),
      });
      if (res.ok) { sent = true; }
      else { console.error("Twilio error:", await res.text()); }
    } catch (e) { console.error("Twilio error:", e); }
  }

  if (!sent) {
    console.log("\n========== SMS (mock) ==========");
    console.log("To:", payload.to);
    console.log("Body:", payload.body);
    console.log("===============================\n");
    sent = true;
  }

  await db.notification.update({ where: { id: record.id }, data: { status: sent ? "sent" : "failed", sentAt: sent ? new Date() : null } });
  return { ok: sent, id: record.id };
}

export function welcomeSms(name: string, docLink: string): string {
  return `Welcome to Lines & Logos, ${name}! Complete your onboarding by signing your documents here: ${docLink} (link expires in 7 days). Questions? Reply to this text.`;
}

export function arrivalWindowSms(clientName: string, jobTitle: string, window: string): string {
  return `Hi ${clientName}, Lines & Logos here. Our crew will arrive for "${jobTitle}" during ${window}. Please ensure building access. Questions? Reply to this text.`;
}

export function jobStatusSms(clientName: string, jobTitle: string, status: string): string {
  return `Hi ${clientName}, update on "${jobTitle}": ${status}. Lines & Logos will keep you posted. Questions? Reply to this text.`;
}