import { db } from "@/lib/db";
import { dailyOpsAgent } from "@/lib/ai-agents";

export default async function DailyOpsPage() {
  const [leads, jobs, invoices, tasks] = await Promise.all([
    db.lead.findMany({ where: { stage: "new" } }),
    db.job.findMany({ where: { status: "in-progress" } }),
    db.invoice.findMany({ where: { status: "overdue" } }),
    db.task.findMany({ where: { status: { in: ["pending", "in-progress"] } } }),
  ]);
  const behindSchedule = jobs.filter((j) => j.endDate && new Date(j.endDate) < new Date()).length;
  const brief = dailyOpsAgent({ pendingLeads: leads.length, overdueInvoices: invoices.length, behindScheduleJobs: behindSchedule, todayTasks: tasks.length });

  return (
    <div>
      <div className="top-bar"><h2>Daily Operations</h2></div>
      <div className="card">
        <pre style={{ fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "monospace", background: "#f5f7fa", padding: 20, borderRadius: 6 }}>{brief}</pre>
      </div>
      <div className="grid-3">
        <div className="card stat-card"><div className="num" style={{ color: "#1565c0" }}>{leads.length}</div><div className="label">Pending Leads</div></div>
        <div className="card stat-card"><div className="num" style={{ color: "#c62828" }}>{invoices.length}</div><div className="label">Overdue Invoices</div></div>
        <div className="card stat-card"><div className="num" style={{ color: "#ef6c00" }}>{behindSchedule}</div><div className="label">Behind Schedule</div></div>
      </div>
    </div>
  );
}