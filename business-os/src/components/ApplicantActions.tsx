"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApplicantActions({ applicantId, status }: { applicantId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  const act = async (action: "approve" | "reject") => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/applicants/${applicantId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setMsg(data.message || "Done");
      router.refresh();
    } catch (e: any) { setMsg("Error: " + e.message); }
    finally { setLoading(false); }
  };

  if (status === "approved" || status === "onboarded") return <div className="card" style={{ background: "#e8f5e9" }}>Applicant approved. Employee record created. Onboarding documents sent.</div>;
  if (status === "rejected") return <div className="card" style={{ background: "#ffebee" }}>Applicant rejected.</div>;

  return (
    <div className="card">
      <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Review Actions</h4>
      {msg && <p style={{ marginBottom: 12, color: msg.startsWith("Error") ? "#c62828" : "#2e7d32" }}>{msg}</p>}
      <div className="form-group"><label>Rejection reason (optional)</label><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-success" disabled={loading} onClick={() => act("approve")}>{loading ? "Processing..." : "Approve & Send Onboarding"}</button>
        <button className="btn btn-danger" disabled={loading} onClick={() => act("reject")}>{loading ? "Processing..." : "Reject"}</button>
      </div>
    </div>
  );
}