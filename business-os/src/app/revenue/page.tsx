import { db } from "@/lib/db";

export default async function RevenuePage() {
  const revenue = await db.revenue.findMany({ orderBy: { date: "desc" } });
  const total = revenue.reduce((s, r) => s + r.amount, 0);
  const bySource: Record<string, number> = {};
  revenue.forEach((r) => { bySource[r.source] = (bySource[r.source] || 0) + r.amount; });

  return (
    <div>
      <div className="top-bar"><h2>Revenue ({revenue.length})</h2><a href="/revenue/new" className="btn btn-primary">+ Add Revenue</a></div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">${total.toLocaleString()}</div><div className="lbl">Total Revenue</div></div>
        {Object.entries(bySource).map(([src, amt]) => (
          <div className="kpi" key={src}><div className="val">${amt.toLocaleString()}</div><div className="lbl">{src}</div></div>
        ))}
      </div>
      <div className="card">
        {revenue.length === 0 ? <div className="empty">No revenue recorded.</div> : (
          <table><thead><tr><th>Date</th><th>Source</th><th>Amount</th><th>Account</th><th>Job</th></tr></thead>
          <tbody>{revenue.map((r) => (
            <tr key={r.id}><td>{new Date(r.date).toLocaleDateString()}</td><td>{r.source}</td><td>${r.amount.toLocaleString()}</td><td>{r.accountId || "—"}</td><td>{r.jobId || "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}