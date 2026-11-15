import { db } from "@/lib/db";

export default async function AppointmentsPage() {
  const tasks = await db.task.findMany({ where: { title: { contains: "appointment" } }, orderBy: { dueDate: "asc" } });

  return (
    <div>
      <div className="top-bar"><h2>Appointments & Bookings</h2><a href="/appointments/new" className="btn btn-primary">+ Book Appointment</a></div>
      <div className="card">
        <h4 style={{ color: "#1F3864", marginBottom: 12 }}>Booking System</h4>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Appointment booking form → AI proposes time slots → confirmation tasks → daily schedule + prep reminders.</p>
        <div className="empty">No appointments scheduled. Use Calendly/Cal.com integration or create tasks manually.</div>
      </div>
    </div>
  );
}