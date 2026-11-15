// SMS service. Mock implementation stores messages in DB + console.
// To use real SMS, set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER
// and replace the `sendSms` body with twilio calls.

import { db } from "./db";

export interface SmsPayload {
  to: string;
  body: string;
  applicantId?: string;
}

export async function sendSms(payload: SmsPayload): Promise<{ ok: boolean; id: string }> {
  const record = await db.notification.create({
    data: {
      type: "sms",
      recipient: payload.to,
      body: payload.body,
      status: "sent",
      sentAt: new Date(),
      applicantId: payload.applicantId,
    },
  });

  console.log("\n========== SMS SENT ==========");
  console.log("To:", payload.to);
  console.log("Body:", payload.body);
  console.log("=============================\n");

  // TODO: Production implementation:
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({ body: payload.body, from: process.env.TWILIO_FROM_NUMBER, to: payload.to });

  return { ok: true, id: record.id };
}

export function welcomeSms(name: string, docLink: string): string {
  return `Welcome to Lines & Logos, ${name}! Complete your onboarding by signing your documents here: ${docLink} (link expires in 7 days). Questions? Reply to this text.`;
}
