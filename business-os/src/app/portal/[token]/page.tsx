"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Doc { id: string; type: string; title: string; content: string; signed: boolean; signedAt: string | null; token: string; }
interface PortalData { employee: { id: string; firstName: string; lastName: string; email: string; position: string; allDocsSigned: boolean }; documents: Doc[]; }

export default function PortalPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [signing, setSigning] = useState(false);
  const [signMsg, setSignMsg] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`/api/portal/${token}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load");
      setData(d);
      if (!activeDoc && d.documents.length > 0) {
        const firstUnsigned = d.documents.find((doc: Doc) => !doc.signed);
        setActiveDoc(firstUnsigned?.id || d.documents[0].id);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const signDoc = async (docToken: string) => {
    if (!signature.trim()) { setSignMsg("Please type your full name as signature."); return; }
    setSigning(true);
    setSignMsg("");
    try {
      const res = await fetch(`/api/portal/${docToken}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Sign failed");
      setSignMsg("Document signed successfully!");
      setSignature("");
      await load();
    } catch (e: any) { setSignMsg("Error: " + e.message); }
    finally { setSigning(false); }
  };

  if (loading) return <div className="section container"><p>Loading your documents...</p></div>;
  if (error) return <div className="section container"><div className="card" style={{ background: "#ffebee", color: "#c62828" }}>{error}</div></div>;
  if (!data) return null;

  const { employee, documents } = data;
  const signed = documents.filter((d) => d.signed);
  const currentDoc = documents.find((d) => d.id === activeDoc);

  return (
    <div className="section container">
      <h3>Onboarding Portal</h3>
      <p style={{ color: "#555", marginBottom: 16 }}>Welcome, <strong>{employee.firstName} {employee.lastName}</strong> — {employee.position}</p>
      {employee.allDocsSigned && (
        <div className="card" style={{ background: "#e8f5e9", marginBottom: 16 }}>
          <h4 style={{ color: "#2e7d32" }}>All Documents Signed!</h4>
          <p>Your onboarding is complete. Copies have been sent to you and our team. Welcome to Lines & Logos!</p>
        </div>
      )}
      <div className="grid-2">
        <div>
          <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Documents ({signed.length}/{documents.length} signed)</h4>
          {documents.map((doc) => (
            <div key={doc.id} className="doc-card" style={{ cursor: "pointer", borderColor: activeDoc === doc.id ? "#1F3864" : "#e0e0e0", background: activeDoc === doc.id ? "#f0f4fa" : "#fff" }} onClick={() => setActiveDoc(doc.id)}>
              <h4>{doc.title}</h4>
              <span className={`badge ${doc.signed ? "badge-approved" : "badge-pending"}`} style={{ float: "right" }}>{doc.signed ? "Signed" : "Pending"}</span>
              <p style={{ fontSize: 12, color: "#888" }}>{doc.type.toUpperCase()}</p>
              {doc.signed && doc.signedAt && <p style={{ fontSize: 11, color: "#2e7d32" }}>Signed {new Date(doc.signedAt).toLocaleString()}</p>}
            </div>
          ))}
        </div>
        <div>
          {currentDoc && (
            <div className="card">
              <h4 style={{ color: "#1F3864", marginBottom: 12 }}>{currentDoc.title}</h4>
              <div style={{ maxHeight: 400, overflowY: "auto", padding: 16, border: "1px solid #eee", borderRadius: 6, marginBottom: 16, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: currentDoc.content }} />
              {!currentDoc.signed ? (
                <>
                  <div className="form-group"><label>Type your full name as signature</label><input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder={`${employee.firstName} ${employee.lastName}`} /></div>
                  {signMsg && <p style={{ marginBottom: 12, color: signMsg.startsWith("Error") ? "#c62828" : "#2e7d32" }}>{signMsg}</p>}
                  <button className="btn btn-success" disabled={signing || !signature.trim()} onClick={() => signDoc(currentDoc.token)} style={{ width: "100%" }}>{signing ? "Signing..." : "Sign Document"}</button>
                  <p style={{ fontSize: 11, color: "#888", marginTop: 8 }}>By signing, you agree to the terms. Your IP address and timestamp will be recorded.</p>
                </>
              ) : (
                <div className="signature-box signed"><p style={{ color: "#2e7d32", fontWeight: 600 }}>✓ Signed on {currentDoc.signedAt ? new Date(currentDoc.signedAt).toLocaleString() : ""}</p></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}