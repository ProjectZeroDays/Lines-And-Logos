"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEmployeePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", team: "", timezone: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/employees");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>Add Employee</h3>
      <form onSubmit={submit} className="card">
        <div className="form-group"><label>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-row">
          <div className="form-group"><label>Email *</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="form-group"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Role</label><input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
          <div className="form-group"><label>Team</label><input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Timezone</label><input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="America/Chicago" /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Saving..." : "Add Employee"}</button>
      </form>
    </div>
  );
}