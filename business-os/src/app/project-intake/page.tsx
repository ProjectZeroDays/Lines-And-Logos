import { db } from "@/lib/db";

export default async function ProjectIntakePage() {
  const tasks = await db.task.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <div>
      <div className="top-bar"><h2>Project Intake</h2><a href="/project-intake/new" className="btn btn-primary">+ New Intake</a></div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Universal Project Intake</h4>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Messy input → AI generates scope, milestones, tasks → daily triage backlog + overdue follow-ups.</p>
        <div className="empty">No project intakes yet. Submit a new intake to get started.</div>
      </div>
    </div>
  );
}