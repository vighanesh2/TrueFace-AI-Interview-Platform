import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { ObjectId, type Collection } from "mongodb";
import { getDb } from "./mongodb";

const SESSION_COOKIE = "session";
const SESSION_DAYS = 7;
const BCRYPT_ROUNDS = 12;

export type SessionUser = { id: string; email: string };

type UserFields = {
  email: string;
  passwordHash: string;
  createdAt: Date;
};

type UserDoc = UserFields & { _id: ObjectId };

type SessionFields = {
  token: string;
  userId: ObjectId;
  expiresAt: Date;
};

type SessionDoc = SessionFields & { _id?: ObjectId };

function usersCollection(db: Awaited<ReturnType<typeof getDb>>): Collection<UserFields & { _id?: ObjectId }> {
  return db.collection<UserFields & { _id?: ObjectId }>("users");
}

function sessionsCollection(db: Awaited<ReturnType<typeof getDb>>): Collection<SessionDoc> {
  return db.collection<SessionDoc>("sessions");
}

export async function ensureAuthIndexes() {
  const db = await getDb();
  await usersCollection(db).createIndex({ email: 1 }, { unique: true });
  await sessionsCollection(db).createIndex({ token: 1 }, { unique: true });
  await sessionsCollection(db).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createUser(email: string, passwordHash: string): Promise<ObjectId> {
  const db = await getDb();
  const result = await usersCollection(db).insertOne({
    email: email.toLowerCase().trim(),
    passwordHash,
    createdAt: new Date(),
  });
  return result.insertedId;
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const db = await getDb();
  const user = await usersCollection(db).findOne({ email: email.toLowerCase().trim() });
  if (!user?._id) return null;
  return user as UserDoc;
}

export async function createSession(userId: ObjectId): Promise<string> {
  const db = await getDb();
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sessionsCollection(db).insertOne({ token, userId, expiresAt });
  return token;
}

export async function deleteSessionByToken(token: string): Promise<void> {
  const db = await getDb();
  await sessionsCollection(db).deleteOne({ token });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const session = await sessionsCollection(db).findOne({
    token,
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;

  const user = await usersCollection(db).findOne({ _id: session.userId });
  if (!user?._id) return null;

  return { id: user._id.toString(), email: user.email };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export { SESSION_COOKIE };
