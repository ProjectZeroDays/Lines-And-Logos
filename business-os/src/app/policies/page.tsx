import { db } from "@/lib/db";

export default async function PoliciesPage() {
  const policies = await db.policy.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <div>
      <div className="top-bar"><h2>Policies ({policies.length})</h2><a href="/policies/new" className="btn btn-primary">+ New Policy</a></div>
      <div className="card">
        {policies.length === 0 ? <div className="empty">No policies yet. Create safety, HR, or compliance policies.</div> : (
          <table><thead><tr><th>Title</th><th>Category</th><th>Version</th><th>Status</th><th>Author</th><th>Updated</th></tr></thead>
          <tbody>{policies.map((p) => (
            <tr key={p.id}><td>{p.title}</td><td>{p.category}</td><td>v{p.version}</td><td><span className={`badge badge-${p.status === "published" || p.status === "approved" ? "approved" : "pending"}`}>{p.status}</span></td><td>{p.author || "—"}</td><td>{new Date(p.updatedAt).toLocaleDateString()}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}