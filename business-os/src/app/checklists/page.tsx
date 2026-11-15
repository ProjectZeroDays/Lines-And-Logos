import { db } from "@/lib/db";

export default async function ChecklistsPage() {
  const checklists = await db.checklist.findMany({ include: { runs: true } });
  const runs = await db.checklistRun.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { checklist: true, job: true } });

  return (
    <div>
      <div className="top-bar"><h2>Checklists ({checklists.length})</h2><a href="/checklists/new" className="btn btn-primary">+ New Checklist</a></div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Checklist Library</h3></div>
          {checklists.length === 0 ? <div className="empty">No checklists yet.</div> : (
            <table><thead><tr><th>Name</th><th>Type</th><th>Runs</th></tr></thead>
            <tbody>{checklists.map((c) => (
              <tr key={c.id}><td>{c.name}</td><td>{c.type}</td><td>{c.runs.length}</td></tr>
            ))}</tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h3>Recent Runs</h3></div>
          {runs.length === 0 ? <div className="empty">No runs yet.</div> : (
            <table><thead><tr><th>Checklist</th><th>Job</th><th>Completed By</th><th>Date</th></tr></thead>
            <tbody>{runs.map((r) => (
              <tr key={r.id}><td>{r.checklist?.name || "—"}</td><td>{r.job?.title || "—"}</td><td>{r.completedBy || "—"}</td><td>{r.createdAt.toLocaleDateString()}</td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}