import Link from "next/link";
import { db } from "@/lib/db";

export default async function EmployeesPage() {
  const employees = await db.employee.findMany({
    orderBy: { createdAt: "desc" },
    include: { applicant: true },
  });

  return (
    <div className="section container">
      <h3>Employees ({employees.length})</h3>
      <div className="card">
        <table>
          <thead>
            <tr><th>Name</th><th>Position</th><th>Email</th><th>Phone</th><th>Status</th><th>W-9</th><th>1099 Ack</th><th>Job Desc</th><th>Safety</th><th>All Signed</th><th>Start Date</th></tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>{e.firstName} {e.lastName}</td>
                <td>{e.position}</td>
                <td>{e.email}</td>
                <td>{e.phone}</td>
                <td><span className={`badge badge-${e.status === "active" ? "approved" : "rejected"}`}>{e.status}</span></td>
                <td>{e.w9Signed ? "✓" : "—"}</td>
                <td>{e.ack1099Signed ? "✓" : "—"}</td>
                <td>{e.jobDescSigned ? "✓" : "—"}</td>
                <td>{e.safetySigned ? "✓" : "—"}</td>
                <td>{e.allDocsSigned ? "✓" : "—"}</td>
                <td>{e.startDate ? new Date(e.startDate).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16 }}>
        <Link href="/admin" className="btn btn-secondary">← Back to Dashboard</Link>
      </div>
    </div>
  );
}