import Link from "next/link";

export default function Home() {
  return (
    <div>
      <section className="hero">
        <div className="container">
          <h2>Join the Lines & Logos Team</h2>
          <p>We're hiring 1099 independent contractors for facility branding and athletic surface work across the Memphis metro and Mid-South.</p>
          <Link href="/apply" className="btn btn-primary" style={{ background: "#fff", color: "#1F3864" }}>
            Apply Now
          </Link>
        </div>
      </section>

      <section className="section container">
        <h3>Open Positions</h3>
        <div className="grid-3">
          {[
            { title: "Floor Installer", desc: "Hardwood gym floor sanding, finishing, and refinishing. 2+ yrs experience." },
            { title: "Court Striping Technician", desc: "Basketball, volleyball, pickleball line painting. 1+ yr experience." },
            { title: "Vinyl/Graphics Installer", desc: "Wall wraps, window graphics, decals, signage. 1+ yr experience." },
            { title: "Mural Painter", desc: "Custom murals for gyms, hallways, cafeterias. 2+ yrs experience." },
            { title: "General Laborer", desc: "Support crew: prep, cleanup, material handling. Entry-level." },
            { title: "Project Coordinator", desc: "Schedule crews, manage clients, site visits. Admin/field hybrid." },
          ].map((j) => (
            <div className="card" key={j.title}>
              <h4 style={{ color: "#1F3864", marginBottom: 8 }}>{j.title}</h4>
              <p style={{ fontSize: 14, color: "#555" }}>{j.desc}</p>
              <Link href="/apply" className="btn btn-primary" style={{ marginTop: 12, display: "inline-block" }}>
                Apply
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <h3>Why Contract with Us?</h3>
        <div className="grid-2">
          <div className="card">
            <h4>Flexible Engagement</h4>
            <p style={{ fontSize: 14, color: "#555" }}>1099 independent contractor. Per-project or per-hour. You control your schedule. Peak season May–August.</p>
          </div>
          <div className="card">
            <h4>Great Pay</h4>
            <p style={{ fontSize: 14, color: "#555" }}>Competitive rates for skilled trades. Net 15 payment terms. Mileage reimbursement for travel.</p>
          </div>
          <div className="card">
            <h4>Local Work</h4>
            <p style={{ fontSize: 14, color: "#555" }}>Memphis metro + Mid-South (0–400 mi). Most jobs within 60 miles. No long-haul travel.</p>
          </div>
          <div className="card">
            <h4>Growing Company</h4>
            <p style={{ fontSize: 14, color: "#555" }}>One-stop facility branding. Schools, churches, YMCAs, parks. Repeat clients, annual contracts.</p>
          </div>
        </div>
      </section>

      <section className="section container" style={{ textAlign: "center" }}>
        <h3>Ready to Apply?</h3>
        <p style={{ marginBottom: 20, color: "#555" }}>Takes 5 minutes. Our AI agent screens your application instantly.</p>
        <Link href="/apply" className="btn btn-primary">Start Application</Link>
      </section>
    </div>
  );
}