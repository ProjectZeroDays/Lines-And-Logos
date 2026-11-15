"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewRevenuePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ source: "project", amount: "0", date: new Date().toISOString().split("T")[0], accountId: "", jobId: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/revenue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/revenue");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>Add Revenue</h3>
      <form onSubmit={submit} className="card">
        <div className="form-row">
          <div className="form-group"><label>Source</label><select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="project">Project</option><option value="maintenance">Maintenance Agreement</option><option value="add-on">Add-On</option><option value="other">Other</option>
          </select></div>
          <div className="form-group"><label>Amount ($)</label><input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Account ID</label><input value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} /></div>
          <div className="form-group"><label>Job ID</label><input value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Saving..." : "Add Revenue"}</button>
      </form>
    </div>
  );
}