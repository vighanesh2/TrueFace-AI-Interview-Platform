import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { createRecording, ensureRecordingIndexes, listRecordingsForUser, type InterviewType } from "@/lib/recordings";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureRecordingIndexes();
  } catch (e) {
    console.error("Recording indexes:", e);
  }
  const list = await listRecordingsForUser(new ObjectId(user.id));
  return NextResponse.json({
    recordings: list.map((r) => ({
      id: r._id.toString(),
      type: r.type,
      title: r.title,
      status: r.status,
      messageCount: r.messageCount,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = body.type === "behavioral" ? "behavioral" : body.type === "technical" ? "technical" : null;
  if (!type) {
    return NextResponse.json({ error: "type must be technical or behavioral" }, { status: 400 });
  }
  try {
    await ensureRecordingIndexes();
  } catch (e) {
    console.error("Recording indexes:", e);
  }
  const id = await createRecording(new ObjectId(user.id), type as InterviewType);
  return NextResponse.json({ id: id.toString(), type }, { status: 201 });
}
