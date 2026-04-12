import { NextResponse } from "next/server";
import { createUser, ensureAuthIndexes, findUserByEmail, hashPassword, type UserRole } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    await ensureAuthIndexes();
  } catch (e) {
    console.error("Auth index setup:", e);
  }

  let body: { email?: string; password?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const roleRaw = typeof body.role === "string" ? body.role.trim() : "";
  if (roleRaw !== "candidate" && roleRaw !== "interviewer") {
    return NextResponse.json(
      { error: "Choose a role: candidate or interviewer" },
      { status: 400 }
    );
  }
  const role = roleRaw as UserRole;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  await createUser(email, passwordHash, role);

  return NextResponse.json({ ok: true, role }, { status: 201 });
}
