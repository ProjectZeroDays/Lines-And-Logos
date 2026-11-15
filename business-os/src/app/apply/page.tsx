"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const POSITIONS = ["Floor Installer", "Court Striping Technician", "Vinyl/Graphics Installer", "Mural Painter", "General Laborer", "Project Coordinator"];

export default function ApplyPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", address: "", city: "", state: "TN", zip: "",
    position: POSITIONS[0], experience: "0", skills: "", availability: "full-time", hasTransport: false, hasInsurance: false,
    coverLetter: "", references: "",
  });

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      router.push(`/apply/success?id=${data.applicantId}&score=${data.aiScore}&rec=${data.recommendation}`);
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="section" style={{ maxWidth: 720 }}>
      <h3>Contractor Application</h3>
      <p style={{ color: "#555", marginBottom: 24 }}>Lines & Logos — 1099 Independent Contractor. Takes about 5 minutes.</p>
      {error && <div className="card" style={{ background: "#ffebee", color: "#c62828", marginBottom: 16 }}>{error}</div>}
      <form onSubmit={submit} className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Personal Information</h4>
        <div className="form-row">
          <div className="form-group"><label>First Name *</label><input required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /></div>
          <div className="form-group"><label>Last Name *</label><input required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Email *</label><input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} /></div>
          <div className="form-group"><label>Phone *</label><input type="tel" required value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Street Address</label><input value={form.address} onChange={(e) => update("address", e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group"><label>City</label><input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
          <div className="form-group"><label>State</label><input value={form.state} onChange={(e) => update("state", e.target.value)} /></div>
        </div>
        <div className="form-group"><label>ZIP</label><input value={form.zip} onChange={(e) => update("zip", e.target.value)} /></div>
        <h4 style={{ color: "#1F3864", marginBottom: 12, marginTop: 16 }}>Position & Experience</h4>
        <div className="form-group"><label>Position Applied For *</label><select value={form.position} onChange={(e) => update("position", e.target.value)}>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div className="form-row">
          <div className="form-group"><label>Years of Experience *</label><input type="number" min="0" required value={form.experience} onChange={(e) => update("experience", e.target.value)} /></div>
          <div className="form-group"><label>Availability *</label><select value={form.availability} onChange={(e) => update("availability", e.target.value)}>
            <option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="weekends">Weekends only</option><option value="seasonal">Seasonal (summer)</option><option value="flexible">Flexible</option>
          </select></div>
        </div>
        <div className="form-group"><label>Skills (comma-separated)</label><input placeholder="e.g., hardwood flooring, court striping, vinyl wrap" value={form.skills} onChange={(e) => update("skills", e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={form.hasTransport} onChange={(e) => update("hasTransport", e.target.checked)} />
            <label style={{ marginBottom: 0 }}>I have reliable transportation</label>
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={form.hasInsurance} onChange={(e) => update("hasInsurance", e.target.checked)} />
            <label style={{ marginBottom: 0 }}>I carry GL insurance ($1M+)</label>
          </div>
        </div>
        <h4 style={{ color: "#1F3864", marginBottom: 12, marginTop: 16 }}>References & Cover Letter</h4>
        <div className="form-group"><label>References (name, phone, relationship — one per line)</label><textarea rows={3} value={form.references} onChange={(e) => update("references", e.target.value)} /></div>
        <div className="form-group"><label>Cover Letter</label><textarea rows={4} value={form.coverLetter} onChange={(e) => update("coverLetter", e.target.value)} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%", marginTop: 16 }}>
          {submitting ? "Submitting & Screening..." : "Submit Application"}
        </button>
      </form>
    </div>
  );
}