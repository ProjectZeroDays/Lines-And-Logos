import Link from "next/link";
import { db } from "@/lib/db";

export default async function AdminPage() {
  const [total, pending, approved, rejected, onboarded] = await Promise.all([
    db.applicant.count(),
    db.applicant.count({ where: { status: "pending" } }),
    db.applicant.count({ where: { status: "approved" } }),
    db.applicant.count({ where: { status: "rejected" } }),
    db.applicant.count({ where: { status: "onboarded" } }),
  ]);

  const recent = await db.applicant.findMany({
    orderBy: { appliedAt: "desc" },
    take: 10,
  });

  return (
    <div className="section container">
      <h3>Admin Dashboard</h3>
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card stat-card"><div className="num">{total}</div><div className="label">Total Applicants</div></div>
        <div className="card stat-card"><div className="num" style={{ color: "#1565c0" }}>{pending}</div><div className="label">Pending Review</div></div>
        <div className="card stat-card"><div className="num" style={{ color: "#2e7d32" }}>{approved}</div><div className="label">Approved</div></div>
        <div className="card stat-card"><div className="num" style={{ color: "#c62828" }}>{rejected}</div><div className="label">Rejected</div></div>
        <div className="card stat-card"><div className="num" style={{ color: "#7b1fa2" }}>{onboarded}</div><div className="label">Onboarded</div></div>
        <div className="card stat-card"><div className="num">{await db.employee.count()}</div><div className="label">Active Employees</div></div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h4 style={{ color: "#1F3864" }}>Recent Applicants</h4>
          <Link href="/admin/applicants" className="btn btn-secondary">View All</Link>
        </div>
        <table>
          <thead>
            <tr><th>Name</th><th>Position</th><th>AI Score</th><th>Recommendation</th><th>Status</th><th>Applied</th><th></th></tr>
          </thead>
          <tbody>
            {recent.map((a) => (
              <tr key={a.id}>
                <td>{a.firstName} {a.lastName}</td>
                <td>{a.position}</td>
                <td>{a.aiScore}</td>
                <td><span className={`badge badge-${a.aiRecommendation}`}>{a.aiRecommendation}</span></td>
                <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                <td>{new Date(a.appliedAt).toLocaleDateString()}</td>
                <td><Link href={`/admin/applicants/${a.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Review</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20 }}>
        <Link href="/admin/employees" className="btn btn-primary">View Employees</Link>
      </div>
    </div>
  );
}