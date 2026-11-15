"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewVendorPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", category: "subcontractor", contact: "", email: "", phone: "", notes: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/vendors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/vendors");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>New Vendor / Subcontractor</h3>
      <form onSubmit={submit} className="card">
        <div className="form-group"><label>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-group"><label>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="subcontractor">Subcontractor</option><option value="supplier">Supplier</option><option value="service">Service Provider</option>
        </select></div>
        <div className="form-row">
          <div className="form-group"><label>Contact</label><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
          <div className="form-group"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="form-group"><label>Notes</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Saving..." : "Add Vendor"}</button>
      </form>
    </div>
  );
}