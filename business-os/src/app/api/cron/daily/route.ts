import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyOpsAgent, invoiceReminderAgent, healthScoreAgent } from "@/lib/ai-agents";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

// Daily cron job: runs automations that should happen every day.
// Trigger via: GET /api/cron/daily (protected by CRON_SECRET)
// Or set up Vercel Cron / GitHub Actions to hit this endpoint daily.

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  // 1. Daily ops brief
  const [leads, jobs, invoices, tasks] = await Promise.all([
    db.lead.findMany({ where: { stage: "new" } }),
    db.job.findMany({ where: { status: "in-progress" } }),
    db.invoice.findMany({ where: { status: "overdue" } }),
    db.task.findMany({ where: { status: { in: ["pending", "in-progress"] } } }),
  ]);
  const behindSchedule = jobs.filter((j) => j.endDate && new Date(j.endDate) < new Date()).length;
  const brief = dailyOpsAgent({ pendingLeads: leads.length, overdueInvoices: invoices.length, behindScheduleJobs: behindSchedule, todayTasks: tasks.length });
  results.push("Daily ops brief generated");

  // 2. Overdue invoice reminders (escalating)
  const overdueInvoices = await db.invoice.findMany({ where: { status: "overdue" }, include: { account: true } });
  for (const inv of overdueInvoices) {
    const daysOverdue = Math.floor((Date.now() - new Date(inv.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
    const reminder = invoiceReminderAgent(daysOverdue);
    if (reminder.type !== "none") {
      const lastReminder = await db.reminder.findFirst({ where: { invoiceId: inv.id }, orderBy: { sentAt: "desc" } });
      const alreadySentToday = lastReminder && new Date(lastReminder.sentAt).toDateString() === new Date().toDateString();
      if (!alreadySentToday) {
        const tone = reminder.type as "friendly" | "firm" | "final";
        await sendEmail({
          to: inv.account?.name ? `${inv.account.name}` : "client",
          subject: `${tone === "final" ? "FINAL NOTICE" : "Reminder"}: Invoice ${inv.number}`,
          body: `<p>${reminder.message}</p><p>Invoice: ${inv.number}, Amount: $${inv.amount.toLocaleString()}, Due: ${inv.dueDate?.toLocaleDateString()}</p>`,
        });
        await db.reminder.create({ data: { invoiceId: inv.id, type: tone, channel: "email" } });
        results.push(`Reminder sent for invoice ${inv.number} (${tone})`);
      }
    }
  }

  // 3. Task overdue check
  const overdueTasks = await db.task.findMany({ where: { status: { in: ["pending", "in-progress"] }, dueDate: { lt: new Date() } } });
  for (const task of overdueTasks) {
    await db.task.update({ where: { id: task.id }, data: { status: "overdue" } });
  }
  if (overdueTasks.length > 0) results.push(`Marked ${overdueTasks.length} tasks as overdue`);

  // 4. Account health check
  const accounts = await db.account.findMany({ include: { invoices: true, jobs: true } });
  for (const acc of accounts) {
    const hasOverdue = acc.invoices.some((i) => i.status === "overdue");
    const health = healthScoreAgent({ lastTouch: acc.updatedAt, hasOverdueInvoice: hasOverdue, jobCount: acc.jobs.length });
    await db.account.update({ where: { id: acc.id }, data: { health: health.health, risks: health.risks.join(", ") } });
  }
  results.push(`Updated health scores for ${accounts.length} accounts`);

  // 5. Log activity
  await db.activityLog.create({ data: { action: "cron_daily", entity: "system", details: results.join("; ") } });

  return NextResponse.json({ ok: true, results });
}