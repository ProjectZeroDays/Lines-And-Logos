import { db } from "@/lib/db";

export default async function FeedbackPage() {
  const tasks = await db.task.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <div>
      <div className="top-bar"><h2>Feedback & Surveys</h2><a href="/feedback/new" className="btn btn-primary">+ New Survey</a></div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Feedback Collection</h4>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Collect client feedback, NPS scores, and feature requests. The Feedback Synth agent clusters themes and drafts summaries weekly.</p>
        <div className="empty">No feedback collected yet. Create a survey to start.</div>
      </div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Open Tasks (from feedback)</h4>
        {tasks.length === 0 ? <div className="empty">No tasks.</div> : (
          <table><thead><tr><th>Task</th><th>Owner</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>{tasks.map((t) => (
            <tr key={t.id}><td>{t.title}</td><td>{t.owner || "—"}</td><td>{t.priority}</td><td>{t.status}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}