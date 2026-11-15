import { db } from "@/lib/db";

export default async function ContactsPage() {
  const contacts = await db.contact.findMany({ orderBy: { createdAt: "desc" }, include: { account: true } });
  return (
    <div>
      <div className="top-bar"><h2>Contacts ({contacts.length})</h2><a href="/contacts/new" className="btn btn-primary">+ New Contact</a></div>
      <div className="card">
        {contacts.length === 0 ? <div className="empty">No contacts yet.</div> : (
          <table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Account</th><th>Last Touch</th></tr></thead>
          <tbody>{contacts.map((c) => (
            <tr key={c.id}><td>{c.name}</td><td>{c.role || "—"}</td><td>{c.email || "—"}</td><td>{c.phone || "—"}</td><td>{c.account?.name || "—"}</td><td>{c.lastTouch ? new Date(c.lastTouch).toLocaleDateString() : "—"}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}