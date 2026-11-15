import { db } from "@/lib/db";

export default async function InvoicesPage() {
  const invoices = await db.invoice.findMany({ orderBy: { createdAt: "desc" }, include: { account: true, job: true, payments: true } });
  const totalOutstanding = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === "overdue").length;

  return (
    <div>
      <div className="top-bar">
        <h2>Invoices ({invoices.length})</h2>
        <a href="/invoices/new" className="btn btn-primary">+ New Invoice</a>
      </div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">${totalOutstanding.toLocaleString()}</div><div className="lbl">Outstanding</div></div>
        <div className="kpi"><div className="val" style={{ color: "#2e7d32" }}>${totalPaid.toLocaleString()}</div><div className="lbl">Paid</div></div>
        <div className="kpi"><div className="val" style={{ color: "#c62828" }}>{overdue}</div><div className="lbl">Overdue</div></div>
      </div>
      <div className="card">
        {invoices.length === 0 ? <div className="empty">No invoices yet.</div> : (
          <table>
            <thead><tr><th>Invoice #</th><th>Account</th><th>Job</th><th>Amount</th><th>Status</th><th>Due Date</th><th>Paid Date</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.number}</td>
                  <td>{inv.account?.name || "—"}</td>
                  <td>{inv.job?.title || "—"}</td>
                  <td>${inv.amount.toLocaleString()}</td>
                  <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                  <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                  <td>{inv.paidDate ? new Date(inv.paidDate).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}