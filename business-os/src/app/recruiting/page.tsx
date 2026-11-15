import { db } from "@/lib/db";

export default async function RecruitingPage() {
  const candidates = await db.candidate.findMany({ orderBy: { createdAt: "desc" } });
  const byStage: Record<string, number> = {};
  candidates.forEach((c) => { byStage[c.stage] = (byStage[c.stage] || 0) + 1; });

  return (
    <div>
      <div className="top-bar"><h2>Recruiting CRM ({candidates.length})</h2><a href="/recruiting/new" className="btn btn-primary">+ Add Candidate</a></div>
      <div className="kpi-row">
        {Object.entries(byStage).map(([stage, count]) => (
          <div className="kpi" key={stage}><div className="val">{count}</div><div className="lbl">{stage}</div></div>
        ))}
      </div>
      <div className="card">
        {candidates.length === 0 ? <div className="empty">No candidates yet.</div> : (
          <table><thead><tr><th>Name</th><th>Role</th><th>Stage</th><th>Source</th><th>Score</th><th>Next Interview</th></tr></thead>
          <tbody>{candidates.map((c) => (
            <tr key={c.id}><td>{c.name}</td><td>{c.role}</td><td><span className={`badge badge-${c.stage === "hired" ? "approved" : c.stage === "rejected" ? "rejected" : "pending"}`}>{c.stage}</span></td>
            <td>{c.source || "—"}</td><td>{c.score ? c.score.toFixed(1) : "—"}</td><td>{c.nextInterview ? new Date(c.nextInterview).toLocaleDateString() : "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}