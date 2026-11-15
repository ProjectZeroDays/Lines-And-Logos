import Link from "next/link";
import { db } from "@/lib/db";
import ApplicantActions from "@/components/ApplicantActions";

export default async function ApplicantDetailPage({ params }: { params: { id: string } }) {
  const a = await db.applicant.findUnique({ where: { id: params.id }, include: { documents: true, employee: true, notifications: true } });
  if (!a) return <div className="section container"><p>Applicant not found.</p></div>;

  const badgeClass = a.aiRecommendation === "strong" ? "badge-strong" : a.aiRecommendation === "moderate" ? "badge-moderate" : "badge-weak";

  return (
    <div className="section container">
      <Link href="/admin/applicants" className="btn btn-secondary" style={{ marginBottom: 16, display: "inline-block" }}>← Back</Link>
      <div className="card">
        <h3 style={{ color: "#1F3864", marginBottom: 12 }}>{a.firstName} {a.lastName}</h3>
        <div className="grid-2">
          <div>
            <p><strong>Position:</strong> {a.position}</p>
            <p><strong>Email:</strong> {a.email}</p>
            <p><strong>Phone:</strong> {a.phone}</p>
            <p><strong>Address:</strong> {a.address || "—"}, {a.city || ""} {a.state || ""} {a.zip || ""}</p>
            <p><strong>Experience:</strong> {a.experience} years</p>
            <p><strong>Skills:</strong> {a.skills || "—"}</p>
            <p><strong>Availability:</strong> {a.availability}</p>
            <p><strong>Transport:</strong> {a.hasTransport ? "Yes" : "No"} | <strong>Insurance:</strong> {a.hasInsurance ? "Yes" : "No"}</p>
          </div>
          <div>
            <p><strong>AI Score:</strong> <span style={{ fontSize: 24, fontWeight: 700, color: "#1F3864" }}>{a.aiScore}/100</span></p>
            <p><strong>Recommendation:</strong> <span className={`badge ${badgeClass}`}>{a.aiRecommendation}</span></p>
            <p><strong>Status:</strong> <span className={`badge badge-${a.status}`}>{a.status}</span></p>
            <p><strong>Applied:</strong> {new Date(a.appliedAt).toLocaleString()}</p>
            {a.approvedAt && <p><strong>Approved:</strong> {new Date(a.approvedAt).toLocaleString()}</p>}
            {a.rejectedAt && <p><strong>Rejected:</strong> {new Date(a.rejectedAt).toLocaleString()} — {a.rejectedReason}</p>}
          </div>
        </div>
      </div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 8 }}>AI Screening Summary</h4>
        <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{a.aiSummary}</p>
        {a.coverLetter && (<><h4 style={{ color: "#1F3864", marginTop: 16, marginBottom: 8 }}>Cover Letter</h4><p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{a.coverLetter}</p></>)}
        {a.references && (<><h4 style={{ color: "#1F3864", marginTop: 16, marginBottom: 8 }}>References</h4><p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{a.references}</p></>)}
      </div>
      <ApplicantActions applicantId={a.id} status={a.status} />
      {a.employee && (
        <div className="card">
          <h4 style={{ color: "#1F3864", marginBottom: 8 }}>Employee Record</h4>
          <p><strong>ID:</strong> {a.employee.id}</p>
          <p><strong>Status:</strong> {a.employee.status}</p>
          <p><strong>Docs:</strong> W-9: {a.employee.w9Signed ? "✓" : "Pending"} | 1099: {a.employee.ack1099Signed ? "✓" : "Pending"} | Job Desc: {a.employee.jobDescSigned ? "✓" : "Pending"} | Safety: {a.employee.safetySigned ? "✓" : "Pending"}</p>
          <p><strong>All Signed:</strong> {a.employee.allDocsSigned ? "Yes" : "No"}</p>
        </div>
      )}
      {a.documents.length > 0 && (
        <div className="card">
          <h4 style={{ color: "#1F3864", marginBottom: 8 }}>Documents</h4>
          <table><thead><tr><th>Type</th><th>Title</th><th>Signed</th><th>Signed At</th></tr></thead>
          <tbody>{a.documents.map((d) => (
            <tr key={d.id}><td>{d.type}</td><td>{d.title}</td><td>{d.signed ? "✓" : "Pending"}</td><td>{d.signedAt ? new Date(d.signedAt).toLocaleString() : "—"}</td></tr>
          ))}</tbody></table>
        </div>
      )}
    </div>
  );
}