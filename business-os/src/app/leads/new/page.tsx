"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewLeadPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "", source: "website", type: "school-district", notes: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/leads");
  };

  return (
    <div className="section" style={{ maxWidth: 600 }}>
      <h3>New Lead</h3>
      <form onSubmit={submit} className="card">
        <div className="form-row">
          <div className="form-group"><label>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="form-group"><label>Company *</label><input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="form-group"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Source</label><select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="website">Website</option><option value="referral">Referral</option><option value="cold-outreach">Cold Outreach</option>
            <option value="inbound">Inbound</option><option value="event">Event</option><option value="social">Social Media</option>
          </select></div>
          <div className="form-group"><label>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="school-district">School District</option><option value="church">Church</option><option value="ymca">YMCA</option>
            <option value="parks">Parks Dept</option><option value="private-school">Private School</option><option value="higher-ed">Higher Ed</option>
          </select></div>
        </div>
        <div className="form-group"><label>Notes</label><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Scoring..." : "Add Lead (AI will score automatically)"}
        </button>
      </form>
    </div>
  );
}