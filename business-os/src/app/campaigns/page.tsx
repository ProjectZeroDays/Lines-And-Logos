import { db } from "@/lib/db";

export default async function CampaignsPage() {
  const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <div className="top-bar"><h2>Campaigns ({campaigns.length})</h2><a href="/campaigns/new" className="btn btn-primary">+ New Campaign</a></div>
      <div className="card">
        {campaigns.length === 0 ? <div className="empty">No campaigns yet.</div> : (
          <table><thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Spend</th><th>Leads</th><th>Conversions</th><th>Start</th><th>End</th></tr></thead>
          <tbody>{campaigns.map((c) => (
            <tr key={c.id}><td>{c.name}</td><td>{c.type}</td><td><span className={`badge badge-${c.status === "active" ? "approved" : "pending"}`}>{c.status}</span></td>
            <td>${c.spend.toLocaleString()}</td><td>{c.leads}</td><td>{c.conversions}</td>
            <td>{c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"}</td><td>{c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}