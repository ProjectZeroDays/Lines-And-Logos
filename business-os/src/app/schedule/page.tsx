import { db } from "@/lib/db";

export default async function SchedulePage() {
  const jobs = await db.job.findMany({ where: { status: { in: ["scheduled", "in-progress"] } }, orderBy: { startDate: "asc" } });

  return (
    <div>
      <div className="top-bar"><h2>Schedule & Capacity</h2></div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Upcoming Jobs</h4>
        {jobs.length === 0 ? <div className="empty">No scheduled jobs.</div> : (
          <table><thead><tr><th>Job</th><th>Type</th><th>Status</th><th>Assigned</th><th>Start</th><th>End</th><th>Crew-Days</th></tr></thead>
          <tbody>{jobs.map((j) => (
            <tr key={j.id}><td>{j.title}</td><td>{j.type}</td><td><span className={`badge badge-${j.status === "in-progress" ? "in-progress" : "scheduled"}`}>{j.status}</span></td>
            <td>{j.assignedTo || "Unassigned"}</td><td>{j.startDate ? new Date(j.startDate).toLocaleDateString() : "—"}</td>
            <td>{j.endDate ? new Date(j.endDate).toLocaleDateString() : "—"}</td><td>{j.crewDays || "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Seasonal Capacity</h4>
        <p style={{ fontSize: 13, color: "#555" }}>Peak window: May–August. 1 crew = ~20 crew-days/month. 2 crews = ~40 crew-days/month. Reserve 2-3 crew-days for weather buffer.</p>
      </div>
    </div>
  );
}