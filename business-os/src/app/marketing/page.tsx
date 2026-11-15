import { db } from "@/lib/db";

export default async function MarketingPage() {
  const [campaigns, posts] = await Promise.all([
    db.campaign.findMany({ orderBy: { createdAt: "desc" } }),
    db.contentPost.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);

  return (
    <div>
      <div className="top-bar"><h2>Marketing Hub</h2></div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">${totalSpend.toLocaleString()}</div><div className="lbl">Total Spend</div></div>
        <div className="kpi"><div className="val">{totalLeads}</div><div className="lbl">Leads Generated</div></div>
        <div className="kpi"><div className="val">{totalConversions}</div><div className="lbl">Conversions</div></div>
        <div className="kpi"><div className="val">{posts.length}</div><div className="lbl">Content Posts</div></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Campaigns</h3><a href="/campaigns" className="btn btn-secondary btn-sm">Manage</a></div>
          {campaigns.length === 0 ? <div className="empty">No campaigns yet.</div> : (
            <table><thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Spend</th><th>Leads</th></tr></thead>
            <tbody>{campaigns.map((c) => (
              <tr key={c.id}><td>{c.name}</td><td>{c.type}</td><td><span className={`badge badge-${c.status === "active" ? "approved" : "pending"}`}>{c.status}</span></td><td>${c.spend.toLocaleString()}</td><td>{c.leads}</td></tr>
            ))}</tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h3>Recent Content</h3><a href="/content" className="btn btn-secondary btn-sm">Manage</a></div>
          {posts.length === 0 ? <div className="empty">No content yet.</div> : (
            <table><thead><tr><th>Platform</th><th>Status</th><th>Content</th></tr></thead>
            <tbody>{posts.map((p) => (
              <tr key={p.id}><td>{p.platform}</td><td><span className={`badge badge-${p.status === "published" ? "approved" : "pending"}`}>{p.status}</span></td>
              <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.content.slice(0, 50)}</td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h4 style={{ color: "#1F3864", marginBottom: 8 }}>Marketing Automations</h4>
          <ul style={{ fontSize: 13, color: "#555", paddingLeft: 20 }}>
            <li>Competitor Watch (weekly scan of 5 rivals)</li>
            <li>Market Scan (weekly web search for opportunities)</li>
            <li>Social Content Engine (repurpose any content into 7-day post queue)</li>
            <li>Content Planning (weekly editorial loop)</li>
            <li>Landing Page (lead form + headline tests)</li>
            <li>Portfolio Site (monthly refresh)</li>
            <li>Newsletter System (weekly draft edition)</li>
            <li>Email Triage (classify + respond)</li>
          </ul>
        </div>
        <div className="card">
          <h4 style={{ color: "#1F3864", marginBottom: 8 }}>Quick Links</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a href="/content" className="btn btn-secondary">Content Queue</a>
            <a href="/social" className="btn btn-secondary">Social Media</a>
            <a href="/campaigns" className="btn btn-secondary">Campaigns</a>
            <a href="/landing" className="btn btn-secondary">Landing Page</a>
          </div>
        </div>
      </div>
    </div>
  );
}