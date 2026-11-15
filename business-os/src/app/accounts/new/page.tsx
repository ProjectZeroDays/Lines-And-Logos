"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAccountPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", type: "school-district", segment: "mid-market", seats: "0", owner: "", goals: "", risks: "", renewalDate: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/accounts");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>New Account</h3>
      <form onSubmit={submit} className="card">
        <div className="form-group"><label>Account Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-row">
          <div className="form-group"><label>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="school-district">School District</option><option value="church">Church</option><option value="ymca">YMCA</option>
            <option value="parks">Parks Dept</option><option value="private-school">Private School</option><option value="higher-ed">Higher Ed</option>
          </select></div>
          <div className="form-group"><label>Segment</label><select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
            <option value="enterprise">Enterprise</option><option value="mid-market">Mid-Market</option><option value="small">Small</option>
          </select></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Seats / Facilities</label><input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></div>
          <div className="form-group"><label>Owner</label><input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Goals</label><textarea rows={2} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></div>
        <div className="form-group"><label>Risks</label><textarea rows={2} value={form.risks} onChange={(e) => setForm({ ...form, risks: e.target.value })} /></div>
        <div className="form-group"><label>Renewal Date</label><input type="date" value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Creating..." : "Create Account"}</button>
      </form>
    </div>
  );
}