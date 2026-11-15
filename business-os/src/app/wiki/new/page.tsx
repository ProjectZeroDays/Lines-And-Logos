"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewWikiPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", category: "docs", content: "", author: "", status: "draft" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/wiki", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/wiki");
  };

  return (
    <div className="section" style={{ maxWidth: 700 }}>
      <h3>New Wiki Doc</h3>
      <form onSubmit={submit} className="card">
        <div className="form-group"><label>Title *</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="form-row">
          <div className="form-group"><label>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="docs">Docs</option><option value="faq">FAQ</option><option value="changelog">Changelog</option><option value="policy">Policy</option><option value="sop">SOP</option>
          </select></div>
          <div className="form-group"><label>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option><option value="published">Published</option>
          </select></div>
        </div>
        <div className="form-group"><label>Author</label><input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
        <div className="form-group"><label>Content</label><textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Saving..." : "Create Doc"}</button>
      </form>
    </div>
  );
}