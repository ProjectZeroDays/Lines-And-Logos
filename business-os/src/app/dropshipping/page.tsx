import Link from "next/link";

const BRIDGE = "http://localhost:3000";

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BRIDGE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface Agent { id: string; name: string; enabled: boolean; status: string; actionsToday: number; lastRun: string | null; }
interface Order { id: string; customerEmail?: string; grossSales?: number; receivedAt?: string; }
interface Config { marginThreshold: number; autoFulfill: boolean; telegramEnabled: boolean; webSettingsMode: boolean; pauseAll: boolean; }
interface Sync { lastSync: string | null; pendingCommits: number; repo: string; branch: string; }
interface Status { paused: boolean; }

export default async function DropshippingPage() {
  const [status, agents, orders, config, sync] = await Promise.all([
    safeFetch<Status>("/api/control/status"),
    safeFetch<Agent[]>("/api/agents"),
    safeFetch<Order[]>("/api/orders"),
    safeFetch<Config>("/api/config"),
    safeFetch<Sync>("/api/sync/status"),
  ]);

  const online = !!status;

  return (
    <div className="section" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#1F3864", margin: 0 }}>Dropshipping Bridge</h1>
          <p style={{ color: "#666", margin: "4px 0 0" }}>
            Unified view of the autonomous Stripe → Taskade → GitHub bridge. Data source: <code>localhost:3000</code>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className={`badge ${online ? "badge-strong" : "badge-weak"}`}>{online ? "Bridge online" : "Bridge offline"}</span>
          <a href="/bridge" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ display: "inline-block" }}>Open full bridge UI →</a>
        </div>
      </div>

      {!online && (
        <div className="card" style={{ padding: 24, borderLeft: "4px solid #c62828" }}>
          <h3 style={{ color: "#c62828", marginTop: 0 }}>Bridge is offline</h3>
          <p style={{ color: "#555" }}>Start it in a separate terminal:</p>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, overflowX: "auto" }}>cd C:\Projects\autonomous-dropshipping-shopify-taskade-app{"\n"}npm start   # serves on http://localhost:3000</pre>
          <p style={{ color: "#555", fontSize: 13 }}>Once it's up, refresh this page — the metrics below will populate automatically.</p>
        </div>
      )}

      {online && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              ["Orders", orders?.length ?? 0],
              ["Agents", agents?.length ?? 0],
              ["Enabled agents", agents?.filter((a) => a.enabled).length ?? 0],
              ["Pending commits", sync?.pendingCommits ?? 0],
              ["Margin threshold", config?.marginThreshold ?? "—"],
              ["Paused", status?.paused ? "Yes" : "No"],
            ].map(([n, v]) => (
              <div className="card" key={String(n)} style={{ padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#2e7d32" }}>{v}</div>
                <div style={{ color: "#666", fontSize: 13 }}>{n}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ color: "#1F3864", marginTop: 0 }}>Agents</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}><th style={{ padding: 6 }}>Agent</th><th style={{ padding: 6 }}>Enabled</th><th style={{ padding: 6 }}>Status</th><th style={{ padding: 6 }}>Actions today</th></tr></thead>
                <tbody>
                  {(agents || []).map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: 6 }}>{a.name}</td>
                      <td style={{ padding: 6 }}>{a.enabled ? "✓" : "—"}</td>
                      <td style={{ padding: 6 }}>{a.status}</td>
                      <td style={{ padding: 6 }}>{a.actionsToday}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ color: "#1F3864", marginTop: 0 }}>Config & sync</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 1.9, fontSize: 14 }}>
                <li><strong>Auto-fulfill:</strong> {config?.autoFulfill ? "on" : "off"}</li>
                <li><strong>Telegram alerts:</strong> {config?.telegramEnabled ? "on" : "off"}</li>
                <li><strong>Web settings mode:</strong> {config?.webSettingsMode ? "on" : "off"}</li>
                <li><strong>Paused:</strong> {status?.paused ? "yes" : "no"}</li>
                <li><strong>Repo:</strong> {sync?.repo || "—"}</li>
                <li><strong>Branch:</strong> {sync?.branch || "—"}</li>
                <li><strong>Last sync:</strong> {sync?.lastSync || "never"}</li>
                <li><strong>Pending commits:</strong> {sync?.pendingCommits ?? 0}</li>
              </ul>
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginTop: 24 }}>
            <h3 style={{ color: "#1F3864", marginTop: 0 }}>Recent orders ({orders?.length ?? 0})</h3>
            {(orders && orders.length > 0) ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}><th style={{ padding: 6 }}>ID</th><th style={{ padding: 6 }}>Customer</th><th style={{ padding: 6 }}>Gross</th><th style={{ padding: 6 }}>Received</th></tr></thead>
                <tbody>
                  {orders.slice(0, 10).map((o) => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: 6, fontFamily: "monospace", fontSize: 12 }}>{o.id}</td>
                      <td style={{ padding: 6 }}>{o.customerEmail || "—"}</td>
                      <td style={{ padding: 6 }}>{o.grossSales != null ? `$${o.grossSales}` : "—"}</td>
                      <td style={{ padding: 6 }}>{o.receivedAt || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: "#666" }}>No orders yet.</p>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: 24, textAlign: "center", color: "#888", fontSize: 13 }}>
        <Link href="/">← Back to landing</Link> · <Link href="/dashboard">Business OS dashboard</Link>
      </div>
    </div>
  );
}
