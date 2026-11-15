import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lines & Logos — Employee Onboarding",
  description: "Contractor onboarding portal for Lines & Logos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="container">
            <h1>Lines & Logos</h1>
            <nav className="nav">
              <a href="/">Home</a>
              <a href="/apply">Apply</a>
              <a href="/admin">Admin</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}