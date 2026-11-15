import { db } from "@/lib/db";

export default async function FinancePage() {
  const [revenue, expenses] = await Promise.all([
    db.revenue.findMany({ orderBy: { date: "desc" }, take: 20 }),
    db.expense.findMany({ orderBy: { date: "desc" }, take: 20 }),
  ]);
  const totalRev = revenue.reduce((s, r) => s + r.amount, 0);
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const invoices = await db.invoice.findMany();
  const outstanding = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div className="top-bar"><h2>Cash Flow Dashboard</h2></div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">${totalRev.toLocaleString()}</div><div className="lbl">Revenue (recent)</div></div>
        <div className="kpi"><div className="val" style={{ color: "#c62828" }}>${totalExp.toLocaleString()}</div><div className="lbl">Expenses (recent)</div></div>
        <div className="kpi"><div className="val" style={{ color: totalRev - totalExp >= 0 ? "#2e7d32" : "#c62828" }}>${(totalRev - totalExp).toLocaleString()}</div><div className="lbl">Net</div></div>
        <div className="kpi"><div className="val">${outstanding.toLocaleString()}</div><div className="lbl">Outstanding Invoices</div></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Recent Revenue</h3><a href="/revenue" className="btn btn-secondary btn-sm">View All</a></div>
          {revenue.length === 0 ? <div className="empty">No revenue recorded</div> : (
            <table><thead><tr><th>Source</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>{revenue.map((r) => <tr key={r.id}><td>{r.source}</td><td>${r.amount.toLocaleString()}</td><td>{new Date(r.date).toLocaleDateString()}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h3>Recent Expenses</h3><a href="/expenses" className="btn btn-secondary btn-sm">View All</a></div>
          {expenses.length === 0 ? <div className="empty">No expenses recorded</div> : (
            <table><thead><tr><th>Category</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>{expenses.map((e) => <tr key={e.id}><td>{e.category}</td><td>${e.amount.toLocaleString()}</td><td>{new Date(e.date).toLocaleDateString()}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}