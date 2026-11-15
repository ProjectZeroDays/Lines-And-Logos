import { db } from "@/lib/db";

export default async function VendorsPage() {
  const vendors = await db.vendor.findMany({ orderBy: { createdAt: "desc" }, include: { purchaseOrders: true, evaluations: true } });
  const totalSpend = await db.purchaseOrder.aggregate({ _sum: { amount: true } });

  return (
    <div>
      <div className="top-bar"><h2>Vendors & Subcontractors ({vendors.length})</h2><a href="/vendors/new" className="btn btn-primary">+ New Vendor</a></div>
      <div className="kpi-row">
        <div className="kpi"><div className="val">${(totalSpend._sum.amount || 0).toLocaleString()}</div><div className="lbl">Total PO Spend</div></div>
        <div className="kpi"><div className="val">{vendors.filter((v) => v.status === "active").length}</div><div className="lbl">Active Vendors</div></div>
      </div>
      <div className="card">
        {vendors.length === 0 ? <div className="empty">No vendors yet.</div> : (
          <table><thead><tr><th>Name</th><th>Category</th><th>Contact</th><th>Email</th><th>Phone</th><th>Rating</th><th>Contract End</th><th>Status</th><th>POs</th></tr></thead>
          <tbody>{vendors.map((v) => (
            <tr key={v.id}><td>{v.name}</td><td>{v.category}</td><td>{v.contact || "—"}</td><td>{v.email || "—"}</td><td>{v.phone || "—"}</td>
            <td>{v.rating ? v.rating.toFixed(1) : "—"}</td><td>{v.contractEnd ? new Date(v.contractEnd).toLocaleDateString() : "—"}</td>
            <td><span className={`badge badge-${v.status === "active" ? "approved" : "rejected"}`}>{v.status}</span></td><td>{v.purchaseOrders.length}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}