import { db } from "@/lib/db";

export default async function ExpensesPage() {
  const expenses = await db.expense.findMany({ orderBy: { date: "desc" } });
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory: Record<string, number> = {};
  expenses.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });

  return (
    <div>
      <div className="top-bar"><h2>Expenses ({expenses.length})</h2><a href="/expenses/new" className="btn btn-primary">+ Add Expense</a></div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">${total.toLocaleString()}</div><div className="lbl">Total Expenses</div></div>
        {Object.entries(byCategory).map(([cat, amt]) => (
          <div className="kpi" key={cat}><div className="val">${amt.toLocaleString()}</div><div className="lbl">{cat}</div></div>
        ))}
      </div>
      <div className="card">
        {expenses.length === 0 ? <div className="empty">No expenses recorded.</div> : (
          <table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th>Amount</th></tr></thead>
          <tbody>{expenses.map((e) => (
            <tr key={e.id}><td>{new Date(e.date).toLocaleDateString()}</td><td>{e.category}</td><td>{e.description || "—"}</td><td>{e.vendor || "—"}</td><td>${e.amount.toLocaleString()}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}