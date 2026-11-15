import Link from "next/link";
import { db } from "@/lib/db";

export default async function ApplicantsPage() {
  const applicants = await db.applicant.findMany({ orderBy: [{ aiScore: "desc" }, { appliedAt: "desc" }] });

  return (
    <div>
      <div className="top-bar"><h2>Applicants ({applicants.length})</h2></div>
      <div className="card">
        {applicants.length === 0 ? <div className="empty">No applicants yet.</div> : (
          <table><thead><tr><th>Name</th><th>Position</th><th>Exp</th><th>AI Score</th><th>Rec</th><th>Status</th><th>Applied</th><th></th></tr></thead>
          <tbody>{applicants.map((a) => (
            <tr key={a.id}><td>{a.firstName} {a.lastName}</td><td>{a.position}</td><td>{a.experience} yrs</td><td><strong>{a.aiScore}</strong></td>
            <td><span className={`badge badge-${a.aiRecommendation}`}>{a.aiRecommendation}</span></td><td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
            <td>{new Date(a.appliedAt).toLocaleDateString()}</td><td><Link href={`/admin/applicants/${a.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Review</Link></td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}