import { db } from "@/lib/db";

export default async function LandingPage() {
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <div>
      <div className="top-bar"><h2>Landing Page & Lead Capture</h2></div>
      <div className="grid-2">
        <div className="card">
          <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Landing Page</h4>
          <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>Shareable landing page with lead form. Lead form creates a lead + follow-up task and notifies. Weekly headline test suggestions.</p>
          <div className="empty" style={{ padding: 20 }}>Landing page builder coming soon. Use the lead form at /leads/new for now.</div>
        </div>
        <div className="card">
          <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Recent Leads from Landing</h4>
          {leads.length === 0 ? <div className="empty">No leads yet.</div> : (
            <table><thead><tr><th>Name</th><th>Company</th><th>Score</th><th>Tier</th></tr></thead>
            <tbody>{leads.map((l) => (
              <tr key={l.id}><td>{l.name}</td><td>{l.company}</td><td>{l.score}</td><td><span className={`badge badge-${l.tier}`}>{l.tier}</span></td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}