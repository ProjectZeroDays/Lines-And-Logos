"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewInvoicePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ number: "", accountId: "", jobId: "", amount: "0", dueDate: "", notes: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/invoices");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>New Invoice</h3>
      <form onSubmit={submit} className="card">
        <div className="form-row">
          <div className="form-group"><label>Invoice # *</label><input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="L&L-2026-001" /></div>
          <div className="form-group"><label>Amount ($) *</label><input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Account ID</label><input value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} /></div>
          <div className="form-group"><label>Job ID</label><input value={form.jobId} onChange={(e) => setForm({ ...form, jobId: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
        <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Creating..." : "Create Invoice"}</button>
      </form>
    </div>
  );
}