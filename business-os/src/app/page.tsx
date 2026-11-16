import Link from "next/link";

const card = (title: string, desc: string, href: string, accent: string, stats: string[]) => (
  <div className="card" style={{ padding: 28, borderTop: `4px solid ${accent}`, display: "flex", flexDirection: "column", gap: 12, minHeight: 260 }}>
    <h3 style={{ color: "#1F3864", margin: 0, fontSize: 22 }}>{title}</h3>
    <p style={{ color: "#555", margin: 0, lineHeight: 1.5 }}>{desc}</p>
    <ul style={{ margin: 0, paddingLeft: 18, color: "#444", lineHeight: 1.7 }}>
      {stats.map((s) => (<li key={s}>{s}</li>))}
    </ul>
    <div style={{ marginTop: "auto", paddingTop: 12 }}>
      <Link href={href} className="btn btn-primary" style={{ display: "inline-block" }}>Open {title} →</Link>
    </div>
  </div>
);

export default function LandingPage() {
  return (
    <div className="section" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ color: "#1F3864", fontSize: 40, margin: 0 }}>Lines & Logos</h1>
        <p style={{ color: "#666", fontSize: 18, marginTop: 8, maxWidth: 720, marginInline: "auto" }}>
          One operator. One platform. Two revenue engines — facility branding & athletic surfaces for the Mid-South,
          and an autonomous dropshipping bridge — running side by side under a single dashboard.
        </p>
        <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-primary">Go to Business OS →</Link>
          <Link href="/dropshipping" className="btn btn-secondary">Dropshipping Bridge →</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        {card(
          "Facility Branding (Business OS)",
          "The full operating system for a Memphis-based facility branding & athletic surface company — sales, jobs, invoicing, marketing, team, and compliance in one app.",
          "/dashboard",
          "#1F3864",
          ["59 pages · 24 API routes · 35 Prisma models", "9 AI agents (heuristic + LLM)", "1099 onboarding + e-sign portal", "Daily/weekly cron automations"]
        )}
        {card(
          "Dropshipping Bridge",
          "Autonomous Stripe → Taskade → GitHub bridge for dropshipping BI and self-healing deployments. Orders, agents, config, sync status.",
          "/dropshipping",
          "#2e7d32",
          ["Orders, agents, webhooks, sync status", "Pause/resume + margin-threshold control", "GitHub auto-sync (GH_PAT)", "Live at localhost:3000"]
        )}
      </div>

      <div className="card" style={{ marginTop: 32, padding: 24 }}>
        <h3 style={{ color: "#1F3864", marginTop: 0 }}>Quick stats</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, textAlign: "center" }}>
          {[
            ["59", "Pages"],
            ["24", "API routes"],
            ["35", "DB models"],
            ["9", "AI agents"],
            ["2", "Cron jobs"],
            ["0", "Open Dependabot alerts"],
          ].map(([n, l]) => (
            <div key={l}>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#1F3864" }}>{n}</div>
              <div style={{ color: "#666", fontSize: 13 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32, textAlign: "center", color: "#888", fontSize: 13 }}>
        <p>Business OS runs on <strong>localhost:3001</strong> · Dropshipping Bridge runs on <strong>localhost:3000</strong> (proxied under <code>/bridge/*</code>).</p>
        <p>See <a href="/dashboard">Dashboard</a> · <a href="/dropshipping">Dropshipping</a> · <a href="/apply">Apply (public)</a></p>
      </div>
    </div>
  );
}
