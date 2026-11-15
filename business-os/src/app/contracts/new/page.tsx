"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewContractPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", category: "contract", content: "", author: "", status: "draft" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/contracts");
  };

  return (
    <div className="section" style={{ maxWidth: 700 }}>
      <h3>New Contract / Policy</h3>
      <form onSubmit={submit} className="card">
        <div className="form-group"><label>Title *</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="form-row">
          <div className="form-group"><label>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="contract">Contract</option><option value="policy">Policy</option><option value="sop">SOP</option><option value="compliance">Compliance</option>
          </select></div>
          <div className="form-group"><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option><option value="review">Review</option><option value="approved">Approved</option><option value="published">Published</option>
          </select></div>
        </div>
        <div className="form-group"><label>Author</label><input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
        <div className="form-group"><label>Content</label><textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Saving..." : "Create"}</button>
      </form>
    </div>
  );
}