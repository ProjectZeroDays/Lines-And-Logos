import { db } from "@/lib/db";
import { leadScoreAgent } from "@/lib/ai-agents";
import Link from "next/link";

export default async function LeadsPage() {
  const leads = await db.lead.findMany({ orderBy: [{ score: "desc" }, { createdAt: "desc" }] });
  const hot = leads.filter((l) => l.tier === "hot").length;
  const warm = leads.filter((l) => l.tier === "warm").length;
  const cold = leads.filter((l) => l.tier === "cold").length;

  return (
    <div>
      <div className="top-bar">
        <h2>Leads ({leads.length})</h2>
        <a href="/leads/new" className="btn btn-primary">+ New Lead</a>
      </div>
      <div className="kpi-row">
        <div className="kpi"><div className="val" style={{ color: "#c62828" }}>{hot}</div><div className="lbl">Hot Leads</div></div>
        <div className="kpi"><div className="val" style={{ color: "#ef6c00" }}>{warm}</div><div className="lbl">Warm Leads</div></div>
        <div className="kpi"><div className="val" style={{ color: "#1565c0" }}>{cold}</div><div className="lbl">Cold Leads</div></div>
      </div>
      <div className="card">
        {leads.length === 0 ? <div className="empty">No leads yet. <a href="/leads/new">Add your first lead</a></div> : (
          <table>
            <thead><tr><th>Name</th><th>Company</th><th>Type</th><th>Source</th><th>AI Score</th><th>Tier</th><th>Stage</th><th>Owner</th><th>Next Step</th><th>Applied</th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>{l.company}</td>
                  <td>{l.type}</td>
                  <td>{l.source}</td>
                  <td><strong>{l.score}</strong></td>
                  <td><span className={`badge badge-${l.tier}`}>{l.tier}</span></td>
                  <td><span className={`badge badge-${l.stage}`}>{l.stage}</span></td>
                  <td>{l.owner || "—"}</td>
                  <td style={{ fontSize: 12 }}>{l.nextStep || "—"}</td>
                  <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}