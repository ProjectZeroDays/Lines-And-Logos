import { db } from "@/lib/db";

export default async function ApprovalsPage() {
  const tasks = await db.task.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" } });
  const logs = await db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <div>
      <div className="top-bar"><h2>Approvals & Audit Log</h2></div>
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Pending Approvals ({tasks.length})</h3></div>
          {tasks.length === 0 ? <div className="empty">No pending approvals.</div> : (
            <table><thead><tr><th>Task</th><th>Owner</th><th>Priority</th><th>Due</th></tr></thead>
            <tbody>{tasks.map((t) => (
              <tr key={t.id}><td>{t.title}</td><td>{t.owner || "—"}</td><td>{t.priority}</td><td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td></tr>
            ))}</tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h3>Recent Activity (Audit Log)</h3></div>
          {logs.length === 0 ? <div className="empty">No activity yet.</div> : (
            <table><thead><tr><th>Action</th><th>Entity</th><th>Details</th><th>Time</th></tr></thead>
            <tbody>{logs.map((l) => (
              <tr key={l.id}><td>{l.action}</td><td>{l.entity}</td><td style={{ fontSize: 12 }}>{l.details || "—"}</td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}