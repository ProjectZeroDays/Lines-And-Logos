"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function SuccessContent() {
  const params = useSearchParams();
  const score = params.get("score") || "0";
  const rec = params.get("rec") || "pending";
  const badgeClass = rec === "strong" ? "badge-strong" : rec === "moderate" ? "badge-moderate" : "badge-weak";
  const message = rec === "strong" ? "Your application looks great! Our team will review it shortly." : rec === "moderate" ? "Thanks for applying! Our team will review and reach out." : "Thanks for applying. Our team reviews every application.";

  return (
    <div className="section" style={{ maxWidth: 600, textAlign: "center" }}>
      <div className="card">
        <h2 style={{ color: "#2e7d32", marginBottom: 12 }}>Application Submitted!</h2>
        <p style={{ fontSize: 16, marginBottom: 16 }}>{message}</p>
        <div style={{ margin: "20px 0" }}><span className={`badge ${badgeClass}`} style={{ fontSize: 16, padding: "8px 16px" }}>AI Score: {score}/100 — {rec}</span></div>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 24 }}>You'll receive an email confirmation. If approved, you'll get a welcome message with a link to sign your onboarding documents.</p>
        <Link href="/" className="btn btn-primary">Back to Home</Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="section" style={{ maxWidth: 600, textAlign: "center" }}><div className="card"><h2 style={{ color: "#2e7d32" }}>Loading…</h2></div></div>}>
      <SuccessContent />
    </Suspense>
  );
}
