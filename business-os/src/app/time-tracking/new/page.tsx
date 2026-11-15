"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTimeEntryPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ jobId: "", worker: "", hours: "0", date: new Date().toISOString().split("T")[0], billable: true, notes: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/time-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/time-tracking");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>Log Time</h3>
      <form onSubmit={submit} className="card">
        <div className="form-row">
          <div className="form-group"><label>Job ID</label><input value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })} /></div>
          <div className="form-group"><label>Worker *</label><input required value={form.worker} onChange={(e) => setForm({ ...form, worker: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Hours *</label><input type="number" step="0.5" required value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
          <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        </div>
        <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} />
          <label style={{ marginBottom: 0 }}>Billable</label>
        </div>
        <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Saving..." : "Log Time"}</button>
      </form>
    </div>
  );
}