"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewQuotePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: "gym-refresh", value: "0", accountId: "", closeDate: "", notes: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/quotes");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>New Quote / Opportunity</h3>
      <form onSubmit={submit} className="card">
        <div className="form-group"><label>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="gym-refresh">Gym Refresh</option><option value="court-rebrand">Court Rebrand</option><option value="campus-branding">Campus Branding</option>
          <option value="full-facility">Full Facility</option><option value="playground-lot">Playground & Lot</option><option value="fleet-graphics">Fleet Graphics</option>
          <option value="mural">Mural</option><option value="maintenance">Maintenance Agreement</option>
        </select></div>
        <div className="form-row">
          <div className="form-group"><label>Value ($)</label><input type="number" required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          <div className="form-group"><label>Account ID</label><input value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Close Date</label><input type="date" value={form.closeDate} onChange={(e) => setForm({ ...form, closeDate: e.target.value })} /></div>
        <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Saving..." : "Create Quote"}</button>
      </form>
    </div>
  );
}