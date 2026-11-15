import { db } from "@/lib/db";

export default async function SettingsPage() {
  const settings = await db.setting.findMany();

  return (
    <div className="section" style={{ maxWidth: 700 }}>
      <h3>Settings</h3>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Business Settings</h4>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Configure your business parameters. These settings drive automation rules across the platform.</p>
        {settings.length === 0 ? (
          <div className="empty">No settings configured yet. Add settings via the API or database.</div>
        ) : (
          <table><thead><tr><th>Key</th><th>Value</th></tr></thead>
          <tbody>{settings.map((s) => (
            <tr key={s.id}><td>{s.key}</td><td>{s.value}</td></tr>
          ))}</tbody></table>
        )}
      </div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Integrations</h4>
        <table><thead><tr><th>Integration</th><th>Status</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>Email (Resend/SMTP)</td><td><span className="badge badge-pending">Not configured</span></td><td>Set SMTP_* or RESEND_API_KEY in .env</td></tr>
          <tr><td>SMS (Twilio)</td><td><span className="badge badge-pending">Not configured</span></td><td>Set TWILIO_* in .env</td></tr>
          <tr><td>AI (OpenAI/Claude)</td><td><span className="badge badge-pending">Heuristic (built-in)</span></td><td>Replace in src/lib/ai-agents.ts</td></tr>
          <tr><td>Payments (Stripe)</td><td><span className="badge badge-pending">Not configured</span></td><td>Set STRIPE_* in .env</td></tr>
          <tr><td>E-Signature (DocuSign)</td><td><span className="badge badge-pending">Typed signature only</span></td><td>Integrate DocuSign API</td></tr>
        </tbody></table>
      </div>
    </div>
  );
}