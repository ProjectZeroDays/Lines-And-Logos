import { db } from "@/lib/db";

export default async function EmployeesPage() {
  const employees = await db.employee.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <div className="top-bar"><h2>Employees ({employees.length})</h2><a href="/employees/new" className="btn btn-primary">+ Add Employee</a></div>
      <div className="card">
        {employees.length === 0 ? <div className="empty">No employees yet.</div> : (
          <table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Team</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>{employees.map((e) => (
            <tr key={e.id}><td>{e.name}</td><td>{e.role}</td><td>{e.email}</td><td>{e.team || "—"}</td><td><span className={`badge badge-${e.status === "active" ? "approved" : "rejected"}`}>{e.status}</span></td><td>{new Date(e.createdAt).toLocaleDateString()}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}