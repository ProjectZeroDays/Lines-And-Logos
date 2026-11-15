"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewContentPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ platform: "linkedin", content: "", source: "manual", scheduledAt: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    router.push("/content");
  };

  return (
    <div className="section" style={{ maxWidth: 700 }}>
      <h3>New Content Post</h3>
      <form onSubmit={submit} className="card">
        <div className="form-row">
          <div className="form-group"><label>Platform</label><select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            <option value="linkedin">LinkedIn</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="twitter">Twitter/X</option>
          </select></div>
          <div className="form-group"><label>Source</label><select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="manual">Manual</option><option value="case-study">Case Study</option><option value="blog">Blog</option><option value="project">Project</option>
          </select></div>
        </div>
        <div className="form-group"><label>Content</label><textarea rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
        <div className="form-group"><label>Schedule Date</label><input type="date" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Saving..." : "Create Post"}</button>
      </form>
    </div>
  );
}