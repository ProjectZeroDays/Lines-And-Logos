import { db } from "@/lib/db";

export default async function SocialPage() {
  const posts = await db.contentPost.findMany({ orderBy: { createdAt: "desc" } });
  const byPlatform: Record<string, number> = {};
  posts.forEach((p) => { byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1; });

  return (
    <div>
      <div className="top-bar"><h2>Social Media ({posts.length})</h2><a href="/content/new" className="btn btn-primary">+ New Post</a></div>
      <div className="kpi-row">
        {Object.entries(byPlatform).map(([platform, count]) => (
          <div className="kpi" key={platform}><div className="val">{count}</div><div className="lbl">{platform}</div></div>
        ))}
        <div className="kpi"><div className="val">{posts.filter((p) => p.status === "published").length}</div><div className="lbl">Published</div></div>
        <div className="kpi"><div className="val">{posts.filter((p) => p.status === "scheduled").length}</div><div className="lbl">Scheduled</div></div>
      </div>
      <div className="card">
        {posts.length === 0 ? <div className="empty">No posts yet. Create content or use the social content repurposing agent.</div> : (
          <table><thead><tr><th>Platform</th><th>Status</th><th>Scheduled</th><th>Impressions</th><th>Clicks</th><th>Content</th></tr></thead>
          <tbody>{posts.map((p) => (
            <tr key={p.id}><td>{p.platform}</td><td><span className={`badge badge-${p.status === "published" ? "approved" : "pending"}`}>{p.status}</span></td>
            <td>{p.scheduledAt ? new Date(p.scheduledAt).toLocaleDateString() : "—"}</td><td>{p.impressions}</td><td>{p.clicks}</td>
            <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.content.slice(0, 60)}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}