"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const JOB_TYPES = ["gym-refresh", "court-rebrand", "campus-branding", "full-facility", "playground-lot", "fleet-graphics", "mural", "paint-touchup", "vinyl-stickers"];

export default function NewJobPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", type: JOB_TYPES[0], accountId: "", assignedTo: "", crewDays: "5", value: "0", startDate: "", endDate: "", notes: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/jobs");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>New Job</h3>
      <form onSubmit={submit} className="card">
        <div className="form-group"><label>Job Title *</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="form-row">
          <div className="form-group"><label>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></div>
          <div className="form-group"><label>Account ID</label><input value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} placeholder="Paste account ID" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Assigned To</label><input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="Contractor name" /></div>
          <div className="form-group"><label>Crew-Days</label><input type="number" value={form.crewDays} onChange={(e) => setForm({ ...form, crewDays: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Value ($)</label><input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          <div className="form-group"><label>Start Date</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>End Date</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
        <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Creating..." : "Create Job"}</button>
      </form>
    </div>
  );
}