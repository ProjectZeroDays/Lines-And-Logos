import { db } from "@/lib/db";

export default async function SupportPage() {
  const logs = await db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 });

  return (
    <div>
      <div className="top-bar"><h2>Support Portal</h2></div>
      <div className="grid-2">
        <div className="card">
          <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Knowledge Base</h4>
          <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>Help articles, FAQs, and known issues. The Support Agent answers questions and improves articles based on ticket themes.</p>
          <a href="/wiki" className="btn btn-secondary btn-sm">Manage Wiki / KB</a>
        </div>
        <div className="card">
          <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Submit a Ticket</h4>
          <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>Create a support ticket for tracking and resolution.</p>
          <a href="/support/new" className="btn btn-primary btn-sm">+ New Ticket</a>
        </div>
      </div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Recent Activity</h4>
        {logs.length === 0 ? <div className="empty">No activity yet.</div> : (
          <table><thead><tr><th>Action</th><th>Entity</th><th>Details</th><th>Time</th></tr></thead>
          <tbody>{logs.map((l) => (
            <tr key={l.id}><td>{l.action}</td><td>{l.entity}</td><td style={{ fontSize: 12 }}>{l.details || "—"}</td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}