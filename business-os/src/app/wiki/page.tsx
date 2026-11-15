import { db } from "@/lib/db";

export default async function WikiPage() {
  const docs = await db.wikiDoc.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <div>
      <div className="top-bar"><h2>Team Wiki ({docs.length})</h2><a href="/wiki/new" className="btn btn-primary">+ New Doc</a></div>
      <div className="card">
        {docs.length === 0 ? <div className="empty">No wiki docs yet. Create your first SOP, FAQ, or process doc.</div> : (
          <table><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Author</th><th>Updated</th></tr></thead>
          <tbody>{docs.map((d) => (
            <tr key={d.id}><td>{d.title}</td><td>{d.category}</td><td><span className={`badge badge-${d.status === "published" ? "approved" : "pending"}`}>{d.status}</span></td><td>{d.author || "—"}</td><td>{new Date(d.updatedAt).toLocaleDateString()}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}