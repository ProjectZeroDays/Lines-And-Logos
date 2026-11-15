import { db } from "@/lib/db";

export default async function TimeTrackingPage() {
  const entries = await db.timeEntry.findMany({ orderBy: { date: "desc" }, include: { job: true } });
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const billableHours = entries.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
  const byWorker: Record<string, number> = {};
  entries.forEach((e) => { byWorker[e.worker] = (byWorker[e.worker] || 0) + e.hours; });

  return (
    <div>
      <div className="top-bar"><h2>Time Tracking</h2><a href="/time-tracking/new" className="btn btn-primary">+ Log Time</a></div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">{totalHours.toFixed(1)}</div><div className="lbl">Total Hours</div></div>
        <div className="kpi"><div className="val" style={{ color: "#2e7d32" }}>{billableHours.toFixed(1)}</div><div className="lbl">Billable Hours</div></div>
        <div className="kpi"><div className="val">{(totalHours - billableHours).toFixed(1)}</div><div className="lbl">Non-Billable</div></div>
        {Object.entries(byWorker).map(([w, h]) => (
          <div className="kpi" key={w}><div className="val">{h.toFixed(1)}</div><div className="lbl">{w}</div></div>
        ))}
      </div>
      <div className="card">
        {entries.length === 0 ? <div className="empty">No time entries.</div> : (
          <table><thead><tr><th>Date</th><th>Worker</th><th>Job</th><th>Hours</th><th>Billable</th><th>Notes</th></tr></thead>
          <tbody>{entries.map((e) => (
            <tr key={e.id}><td>{new Date(e.date).toLocaleDateString()}</td><td>{e.worker}</td><td>{e.job?.title || "—"}</td><td>{e.hours}</td><td>{e.billable ? "✓" : "—"}</td><td>{e.notes || "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}