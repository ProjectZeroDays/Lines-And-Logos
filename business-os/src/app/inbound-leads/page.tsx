import { db } from "@/lib/db";

export default async function InboundLeadsPage() {
  const leads = await db.lead.findMany({ where: { source: "inbound" }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="top-bar"><h2>Inbound Lead Intake ({leads.length})</h2><a href="/leads/new" className="btn btn-primary">+ New Lead</a></div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Smart Inbox</h4>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Inbound leads are triaged by AI: scored, assigned owner, drafted response, SLA flagged. Branch by type (Sales/Support/Partnership/Press).</p>
        {leads.length === 0 ? <div className="empty">No inbound leads yet.</div> : (
          <table><thead><tr><th>Name</th><th>Company</th><th>Score</th><th>Tier</th><th>Stage</th><th>Owner</th><th>Next Step</th></tr></thead>
          <tbody>{leads.map((l) => (
            <tr key={l.id}><td>{l.name}</td><td>{l.company}</td><td>{l.score}</td><td><span className={`badge badge-${l.tier}`}>{l.tier}</span></td>
            <td><span className={`badge badge-${l.stage}`}>{l.stage}</span></td><td>{l.owner || "—"}</td><td style={{ fontSize: 12 }}>{l.nextStep || "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}