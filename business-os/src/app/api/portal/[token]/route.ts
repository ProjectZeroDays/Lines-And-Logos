import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const doc = await db.document.findUnique({ where: { token: params.token }, include: { employee: { include: { documents: true } } } });
    if (!doc) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    if (doc.expiresAt && new Date() > doc.expiresAt) return NextResponse.json({ error: "This link has expired" }, { status: 410 });
    const employee = doc.employee;
    if (!employee) return NextResponse.json({ error: "No employee record" }, { status: 404 });
    const docs = employee.documents.map((d) => ({ id: d.id, type: d.type, title: d.title, content: d.content, signed: d.signed, signedAt: d.signedAt, token: d.token }));
    const allSigned = docs.every((d) => d.signed);
    return NextResponse.json({ employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, email: employee.email, position: employee.position, allDocsSigned: allSigned }, documents: docs });
  } catch (err: any) {
    console.error("Portal GET error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}