"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewChecklistPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", type: "pre-job", items: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/checklists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/checklists");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>New Checklist</h3>
      <form onSubmit={submit} className="card">
        <div className="form-group"><label>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-group"><label>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="pre-job">Pre-Job</option><option value="post-job">Post-Job</option><option value="safety">Safety</option><option value="quality">Quality</option>
        </select></div>
        <div className="form-group"><label>Items (one per line)</label><textarea rows={6} value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} placeholder="Check moisture levels&#10;Verify floor flatness&#10;Confirm power availability" /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Saving..." : "Create Checklist"}</button>
      </form>
    </div>
  );
}