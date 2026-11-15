import { db } from "@/lib/db";
import { healthScoreAgent } from "@/lib/ai-agents";
import Link from "next/link";

export default async function AccountsPage() {
  const accounts = await db.account.findMany({ orderBy: { updatedAt: "desc" }, include: { contacts: true, jobs: true } });

  return (
    <div>
      <div className="top-bar">
        <h2>Accounts ({accounts.length})</h2>
        <a href="/accounts/new" className="btn btn-primary">+ New Account</a>
      </div>
      <div className="card">
        {accounts.length === 0 ? <div className="empty">No accounts yet.</div> : (
          <table>
            <thead><tr><th>Account</th><th>Type</th><th>Health</th><th>Score</th><th>Contacts</th><th>Jobs</th><th>Renewal</th><th>Risks</th></tr></thead>
            <tbody>
              {accounts.map((a) => {
                const h = healthScoreAgent({ lastTouch: a.updatedAt, hasOverdueInvoice: false, jobCount: a.jobs.length });
                return (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td>{a.type}</td>
                    <td><span className={`badge badge-${h.health}`}>{h.health}</span></td>
                    <td>{h.score}</td>
                    <td>{a.contacts.length}</td>
                    <td>{a.jobs.length}</td>
                    <td>{a.renewalDate ? new Date(a.renewalDate).toLocaleDateString() : "—"}</td>
                    <td style={{ fontSize: 12, color: "#666" }}>{h.risks.length > 0 ? h.risks.join(", ") : "None"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}