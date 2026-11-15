import { db } from "@/lib/db";

export default async function ContractsPage() {
  const policies = await db.policy.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <div>
      <div className="top-bar"><h2>Contracts & Policies</h2><a href="/contracts/new" className="btn btn-primary">+ New Contract/Policy</a></div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Contracts & Policies Library</h4>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Store contracts, policies, and SOPs. The Contract Reviewer agent extracts clauses and flags risks. The Policy Generator drafts new policies from inputs.</p>
        {policies.length === 0 ? <div className="empty">No contracts or policies yet.</div> : (
          <table><thead><tr><th>Title</th><th>Category</th><th>Version</th><th>Status</th><th>Author</th><th>Updated</th></tr></thead>
          <tbody>{policies.map((p) => (
            <tr key={p.id}><td>{p.title}</td><td>{p.category}</td><td>v{p.version}</td><td><span className={`badge badge-${p.status === "published" || p.status === "approved" ? "approved" : "pending"}`}>{p.status}</span></td><td>{p.author || "—"}</td><td>{new Date(p.updatedAt).toLocaleDateString()}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}