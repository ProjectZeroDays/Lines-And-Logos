import { db } from "@/lib/db";

export default async function ReportsPage() {
  const [leads, jobs, invoices, revenue, expenses, accounts] = await Promise.all([
    db.lead.findMany(), db.job.findMany(), db.invoice.findMany(), db.revenue.findMany(), db.expense.findMany(), db.account.findMany(),
  ]);
  const totalRev = revenue.reduce((s, r) => s + r.amount, 0);
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const pipeline = leads.filter((l) => l.stage !== "closed" && l.stage !== "lost").length;
  const closedJobs = jobs.filter((j) => j.status === "complete" || j.status === "paid").length;
  const outstanding = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div className="top-bar"><h2>Reports & Analytics</h2></div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">${totalRev.toLocaleString()}</div><div className="lbl">Total Revenue</div></div>
        <div className="kpi"><div className="val">${totalExp.toLocaleString()}</div><div className="lbl">Total Expenses</div></div>
        <div className="kpi"><div className="val" style={{ color: totalRev - totalExp >= 0 ? "#2e7d32" : "#c62828" }}>${(totalRev - totalExp).toLocaleString()}</div><div className="lbl">Net Profit</div></div>
        <div className="kpi"><div className="val">${outstanding.toLocaleString()}</div><div className="lbl">Outstanding AR</div></div>
      </div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">{leads.length}</div><div className="lbl">Total Leads</div></div>
        <div className="kpi"><div className="val">{pipeline}</div><div className="lbl">Active Pipeline</div></div>
        <div className="kpi"><div className="val">{jobs.length}</div><div className="lbl">Total Jobs</div></div>
        <div className="kpi"><div className="val">{closedJobs}</div><div className="lbl">Completed Jobs</div></div>
        <div className="kpi"><div className="val">{accounts.length}</div><div className="lbl">Accounts</div></div>
        <div className="kpi"><div className="val">{invoices.length}</div><div className="lbl">Invoices</div></div>
      </div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Weekly Report</h4>
        <p style={{ fontSize: 13, color: "#555" }}>Auto-generated weekly report compiles data from all modules. Connect to the automated weekly reporting workflow to enable scheduled generation.</p>
      </div>
    </div>
  );
}