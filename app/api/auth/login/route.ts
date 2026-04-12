import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSession,
  ensureAuthIndexes,
  findUserByEmail,
  normalizeUserRole,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await ensureAuthIndexes();
  } catch (e) {
    console.error("Auth index setup:", e);
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSession(user._id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());

  const role = normalizeUserRole((user as { role?: unknown }).role);
  return NextResponse.json({ ok: true, email: user.email, role });
}
