import { db } from "@/lib/db";
import { dailyOpsAgent, healthScoreAgent } from "@/lib/ai-agents";

export default async function DashboardPage() {
  const [leads, jobs, invoices, tasks, accounts] = await Promise.all([
    db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    db.job.findMany({ orderBy: { updatedAt: "desc" }, take: 10 }),
    db.invoice.findMany({ where: { status: { in: ["sent", "overdue"] } } }),
    db.task.findMany({ where: { status: { in: ["pending", "in-progress"] } }, orderBy: { dueDate: "asc" }, take: 10 }),
    db.account.findMany(),
  ]);

  const pendingLeads = leads.filter((l) => l.stage === "new").length;
  const overdueInvoices = invoices.filter((i) => i.status === "overdue").length;
  const behindSchedule = jobs.filter((j) => j.status === "in-progress" && j.endDate && new Date(j.endDate) < new Date()).length;
  const todayTasks = tasks.length;
  const totalRevenue = await db.revenue.aggregate({ _sum: { amount: true } });
  const totalExpenses = await db.expense.aggregate({ _sum: { amount: true } });
  const pipelineValue = await db.deal.aggregate({ _sum: { value: true }, where: { stage: { notIn: ["closed-won", "closed-lost"] } } });

  const opsBrief = dailyOpsAgent({ pendingLeads, overdueInvoices, behindScheduleJobs: behindSchedule, todayTasks });

  // Health scores for accounts
  const accountHealth = accounts.map((a) => {
    const h = healthScoreAgent({ lastTouch: a.updatedAt, hasOverdueInvoice: false, jobCount: 0, nps: undefined });
    return { ...a, healthScore: h.score, healthStatus: h.health, risks: h.risks };
  });

  return (
    <div>
      <div className="top-bar">
        <h2>Dashboard</h2>
        <span style={{ fontSize: 13, color: "#666" }}>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div>

      <div className="kpi-row">
        <div className="kpi"><div className="val">${(totalRevenue._sum.amount || 0).toLocaleString()}</div><div className="lbl">Total Revenue</div></div>
        <div className="kpi"><div className="val">${(totalExpenses._sum.amount || 0).toLocaleString()}</div><div className="lbl">Total Expenses</div></div>
        <div className="kpi"><div className="val">${((totalRevenue._sum.amount || 0) - (totalExpenses._sum.amount || 0)).toLocaleString()}</div><div className="lbl">Net Profit</div></div>
        <div className="kpi"><div className="val">${(pipelineValue._sum.value || 0).toLocaleString()}</div><div className="lbl">Pipeline Value</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Daily Operations Brief</h3></div>
          <pre style={{ fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "monospace", background: "#f5f7fa", padding: 16, borderRadius: 6 }}>{opsBrief}</pre>
        </div>
        <div className="card">
          <div className="card-header"><h3>Today's Tasks</h3></div>
          {tasks.length === 0 ? <div className="empty">No pending tasks</div> : (
            <table>
              <thead><tr><th>Task</th><th>Owner</th><th>Due</th><th>Priority</th></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>{t.owner || "—"}</td>
                    <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                    <td><span className={`badge badge-${t.priority === "urgent" ? "hot" : t.priority === "high" ? "warm" : "cold"}`}>{t.priority}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Recent Leads</h3><a href="/leads" className="btn btn-secondary btn-sm">View All</a></div>
          {leads.length === 0 ? <div className="empty">No leads yet</div> : (
            <table>
              <thead><tr><th>Name</th><th>Company</th><th>Score</th><th>Tier</th><th>Stage</th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>{l.company}</td>
                    <td>{l.score}</td>
                    <td><span className={`badge badge-${l.tier}`}>{l.tier}</span></td>
                    <td><span className={`badge badge-${l.stage}`}>{l.stage}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h3>Active Jobs</h3><a href="/jobs" className="btn btn-secondary btn-sm">View All</a></div>
          {jobs.length === 0 ? <div className="empty">No jobs yet</div> : (
            <table>
              <thead><tr><th>Job</th><th>Type</th><th>Status</th><th>Value</th></tr></thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.title}</td>
                    <td>{j.type}</td>
                    <td><span className={`badge badge-${j.status === "complete" ? "complete" : j.status === "in-progress" ? "in-progress" : j.status === "scheduled" ? "scheduled" : "pending"}`}>{j.status}</span></td>
                    <td>{j.value ? `$${j.value.toLocaleString()}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Account Health</h3><a href="/accounts" className="btn btn-secondary btn-sm">View All</a></div>
        {accountHealth.length === 0 ? <div className="empty">No accounts yet</div> : (
          <table>
            <thead><tr><th>Account</th><th>Type</th><th>Health</th><th>Score</th><th>Risks</th></tr></thead>
            <tbody>
              {accountHealth.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.type}</td>
                  <td><span className={`badge badge-${a.healthStatus}`}>{a.healthStatus}</span></td>
                  <td>{a.healthScore}</td>
                  <td style={{ fontSize: 12, color: "#666" }}>{a.risks.length > 0 ? a.risks.join(", ") : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header"><h3>Open Invoices</h3><a href="/invoices" className="btn btn-secondary btn-sm">View All</a></div>
        {invoices.length === 0 ? <div className="empty">No open invoices</div> : (
          <table>
            <thead><tr><th>Invoice #</th><th>Amount</th><th>Status</th><th>Due Date</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.number}</td>
                  <td>${inv.amount.toLocaleString()}</td>
                  <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                  <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}