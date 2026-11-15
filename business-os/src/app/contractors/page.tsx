import { db } from "@/lib/db";

export default async function ContractorsPage() {
  const employees = await db.employee.findMany({ orderBy: { createdAt: "desc" } });
  const contractors = employees.filter((e) => true); // all employees are 1099 contractors

  return (
    <div>
      <div className="top-bar"><h2>1099 Contractors ({contractors.length})</h2><a href="/apply" className="btn btn-primary">+ New Application</a></div>
      <div className="card">
        {contractors.length === 0 ? <div className="empty">No contractors yet. Share the /apply link to recruit.</div> : (
          <table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Status</th><th>W-9</th><th>1099 Ack</th><th>Job Desc</th><th>Safety</th><th>All Signed</th></tr></thead>
          <tbody>{contractors.map((c) => (
            <tr key={c.id}><td>{c.name}</td><td>{c.role}</td><td>{c.email}</td><td>{c.phone || "—"}</td>
            <td><span className={`badge badge-${c.status === "active" ? "approved" : "rejected"}`}>{c.status}</span></td>
            <td>{c.w9Signed ? "✓" : "—"}</td><td>{c.ack1099Signed ? "✓" : "—"}</td><td>{c.jobDescSigned ? "✓" : "—"}</td>
            <td>{c.safetySigned ? "✓" : "—"}</td><td>{c.allDocsSigned ? "✓" : "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <a href="/admin/applicants" className="btn btn-secondary">Review Applicants</a>
      </div>
    </div>
  );
}