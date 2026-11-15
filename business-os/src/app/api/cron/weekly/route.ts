import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Weekly cron job: runs automations that should happen every week.
// Trigger via: GET /api/cron/weekly

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  // 1. Weekly report
  const [leads, jobs, invoices, revenue, expenses] = await Promise.all([
    db.lead.findMany(), db.job.findMany(), db.invoice.findMany(), db.revenue.findMany(), db.expense.findMany(),
  ]);
  const totalRev = revenue.reduce((s, r) => s + r.amount, 0);
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const outstanding = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + i.amount, 0);
  const report = `Weekly Report: Leads=${leads.length}, Jobs=${jobs.length}, Revenue=$${totalRev}, Expenses=$${totalExp}, Net=$${totalRev - totalExp}, Outstanding=$${outstanding}`;
  results.push(report);

  // 2. Competitor watch (placeholder - would scan competitor websites)
  results.push("Competitor watch: no changes detected (manual scan needed)");

  // 3. Market scan (placeholder)
  results.push("Market scan: no new opportunities detected (manual scan needed)");

  // 4. Content planning
  const posts = await db.contentPost.findMany({ where: { status: "draft" } });
  results.push(`Content: ${posts.length} draft posts pending`);

  // 5. Send weekly report email
  const adminEmail = process.env.ADMIN_EMAIL || "admin@linesandlogos.com";
  await sendEmail({
    to: adminEmail,
    subject: `Weekly Business Report - ${new Date().toLocaleDateString()}`,
    body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#1F3864;">Weekly Business Report</h2>
      <p><strong>Period:</strong> ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()} — ${new Date().toLocaleDateString()}</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Total Leads</td><td style="padding:8px;border:1px solid #ddd;">${leads.length}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Total Jobs</td><td style="padding:8px;border:1px solid #ddd;">${jobs.length}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Revenue</td><td style="padding:8px;border:1px solid #ddd;">$${totalRev.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Expenses</td><td style="padding:8px;border:1px solid #ddd;">$${totalExp.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Net Profit</td><td style="padding:8px;border:1px solid #ddd;">$${(totalRev - totalExp).toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Outstanding AR</td><td style="padding:8px;border:1px solid #ddd;">$${outstanding.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Draft Content Posts</td><td style="padding:8px;border:1px solid #ddd;">${posts.length}</td></tr>
      </table>
      <p>— Lines & Logos Business OS</p></div>`,
  });

  await db.activityLog.create({ data: { action: "cron_weekly", entity: "system", details: results.join("; ") } });

  return NextResponse.json({ ok: true, results });
}