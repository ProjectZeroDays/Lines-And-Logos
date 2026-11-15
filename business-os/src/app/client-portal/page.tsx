import { db } from "@/lib/db";

export default async function ClientPortalPage() {
  const accounts = await db.account.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <div className="top-bar"><h2>Client Onboarding Portal</h2></div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Client Onboarding</h4>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Onboarding intake → checklist → assets → meeting notes → FAQ. Daily/weekly reminders. Auto-generate kickoff agenda when "Ready".</p>
        {accounts.length === 0 ? <div className="empty">No accounts yet. Create an account first.</div> : (
          <table><thead><tr><th>Account</th><th>Type</th><th>Health</th><th>Renewal</th></tr></thead>
          <tbody>{accounts.map((a) => (
            <tr key={a.id}><td>{a.name}</td><td>{a.type}</td><td><span className={`badge badge-${a.health}`}>{a.health}</span></td><td>{a.renewalDate ? new Date(a.renewalDate).toLocaleDateString() : "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}