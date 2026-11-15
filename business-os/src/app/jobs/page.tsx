import { db } from "@/lib/db";
import Link from "next/link";

const JOB_TYPES = ["gym-refresh", "court-rebrand", "campus-branding", "full-facility", "playground-lot", "fleet-graphics", "mural", "paint-touchup", "vinyl-stickers"];

export default async function JobsPage() {
  const jobs = await db.job.findMany({ orderBy: { updatedAt: "desc" }, include: { account: true } });

  return (
    <div>
      <div className="top-bar">
        <h2>Jobs ({jobs.length})</h2>
        <a href="/jobs/new" className="btn btn-primary">+ New Job</a>
      </div>
      <div className="card">
        {jobs.length === 0 ? <div className="empty">No jobs yet.</div> : (
          <table>
            <thead><tr><th>Job</th><th>Type</th><th>Account</th><th>Status</th><th>Assigned</th><th>Start</th><th>End</th><th>Value</th><th>Crew-Days</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.title}</td>
                  <td>{j.type}</td>
                  <td>{j.account?.name || "—"}</td>
                  <td><span className={`badge badge-${j.status === "complete" ? "complete" : j.status === "in-progress" ? "in-progress" : j.status === "scheduled" ? "scheduled" : j.status === "invoiced" ? "sent" : j.status === "paid" ? "paid" : "pending"}`}>{j.status}</span></td>
                  <td>{j.assignedTo || "Unassigned"}</td>
                  <td>{j.startDate ? new Date(j.startDate).toLocaleDateString() : "—"}</td>
                  <td>{j.endDate ? new Date(j.endDate).toLocaleDateString() : "—"}</td>
                  <td>{j.value ? `$${j.value.toLocaleString()}` : "—"}</td>
                  <td>{j.crewDays || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}