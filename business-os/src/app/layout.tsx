import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lines & Logos — Business OS",
  description: "Complete business automation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <aside className="sidebar">
            <div className="sidebar-header">
              <h1>Lines & Logos</h1>
              <p>Business OS v1.0</p>
            </div>
            <nav className="sidebar-nav">
              <div className="sidebar-section">Overview</div>
              <a href="/dashboard">Dashboard</a>
              <a href="/daily-ops">Daily Ops</a>

              <div className="sidebar-section">Sales</div>
              <a href="/leads">Leads</a>
              <a href="/accounts">Accounts</a>
              <a href="/pipeline">Pipeline</a>
              <a href="/contacts">Contacts</a>

              <div className="sidebar-section">Operations</div>
              <a href="/jobs">Jobs</a>
              <a href="/schedule">Schedule</a>
              <a href="/invoices">Invoices</a>
              <a href="/quotes">Quotes</a>
              <a href="/time-tracking">Time Tracking</a>
              <a href="/checklists">Checklists</a>

              <div className="sidebar-section">Finance</div>
              <a href="/finance">Cash Flow</a>
              <a href="/expenses">Expenses</a>
              <a href="/revenue">Revenue</a>

              <div className="sidebar-section">Marketing</div>
              <a href="/content">Content</a>
              <a href="/social">Social Media</a>
              <a href="/campaigns">Campaigns</a>
              <a href="/landing">Landing Page</a>

              <div className="sidebar-section">Team</div>
              <a href="/employees">Employees</a>
              <a href="/contractors">Contractors</a>
              <a href="/vendors">Vendors</a>
              <a href="/recruiting">Recruiting</a>
              <a href="/admin/applicants">Onboarding Applicants</a>
              <a href="/apply">Apply (Public)</a>

              <div className="sidebar-section">Clients</div>
              <a href="/client-portal">Client Portal</a>
              <a href="/support">Support</a>
              <a href="/feedback">Feedback</a>

              <div className="sidebar-section">Admin</div>
              <a href="/wiki">Wiki</a>
              <a href="/policies">Policies</a>
              <a href="/approvals">Approvals</a>
              <a href="/reports">Reports</a>
              <a href="/settings">Settings</a>

              <div className="sidebar-section">Dropshipping Bridge</div>
              <a href="/dropshipping">Bridge Overview</a>
              <a href="/bridge" target="_blank" rel="noopener noreferrer">Open Bridge UI ↗</a>
            </nav>
          </aside>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}