import { db } from "@/lib/db";

export default async function QuotesPage() {
  const opportunities = await db.opportunity.findMany({ orderBy: { createdAt: "desc" }, include: { account: true } });
  const totalValue = opportunities.reduce((s, o) => s + o.value, 0);
  const won = opportunities.filter((o) => o.stage === "closed-won").reduce((s, o) => s + o.value, 0);

  return (
    <div>
      <div className="top-bar"><h2>Quotes & Opportunities ({opportunities.length})</h2><a href="/quotes/new" className="btn btn-primary">+ New Quote</a></div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">${totalValue.toLocaleString()}</div><div className="lbl">Total Pipeline</div></div>
        <div className="kpi"><div className="val" style={{ color: "#2e7d32" }}>${won.toLocaleString()}</div><div className="lbl">Won</div></div>
      </div>
      <div className="card">
        {opportunities.length === 0 ? <div className="empty">No quotes yet.</div> : (
          <table><thead><tr><th>Type</th><th>Account</th><th>Value</th><th>Stage</th><th>Close Date</th></tr></thead>
          <tbody>{opportunities.map((o) => (
            <tr key={o.id}><td>{o.type}</td><td>{o.account?.name || "—"}</td><td>${o.value.toLocaleString()}</td><td><span className={`badge badge-${o.stage === "closed-won" ? "closed" : o.stage === "proposal" ? "quoted" : "pending"}`}>{o.stage}</span></td><td>{o.closeDate ? new Date(o.closeDate).toLocaleDateString() : "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}