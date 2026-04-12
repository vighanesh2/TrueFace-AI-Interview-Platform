import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import {
  bumpRecordingMessageCount,
  deleteRecording,
  getRecordingForUser,
  saveLiveAvatarTranscript,
  setRecordingCompleted,
  setRecordingMeetingVideo,
  type RecordingChatMessage,
  type RecordingSource,
} from "@/lib/recordings";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const rec = await getRecordingForUser(id, new ObjectId(user.id));
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const src: RecordingSource = rec.source ?? "text_chat";
  const msgs = rec.messages;
  return NextResponse.json({
    id: rec._id.toString(),
    type: rec.type,
    title: rec.title,
    status: rec.status,
    messageCount: rec.messageCount,
    source: src,
    messages: msgs ?? [],
    createdAt: rec.createdAt.toISOString(),
    updatedAt: rec.updatedAt.toISOString(),
    meetingVideoUrl: rec.meetingVideoUrl ?? null,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: {
    messageDelta?: number;
    complete?: boolean;
    meetingVideoUrl?: string;
    saveTranscript?: boolean;
    messages?: unknown[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const uid = new ObjectId(user.id);
  if (body.saveTranscript === true && Array.isArray(body.messages)) {
    const msgs = body.messages.filter(
      (m: unknown) =>
        m &&
        typeof m === "object" &&
        typeof (m as { role?: unknown }).role === "string" &&
        typeof (m as { text?: unknown }).text === "string"
    ) as RecordingChatMessage[];
    const ok = await saveLiveAvatarTranscript(id, uid, msgs);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else {
    if (typeof body.messageDelta === "number" && body.messageDelta !== 0) {
      await bumpRecordingMessageCount(id, uid, body.messageDelta);
    }
    if (body.complete === true) {
      await setRecordingCompleted(id, uid);
    }
  }
  if (typeof body.meetingVideoUrl === "string" && body.meetingVideoUrl.startsWith("https://")) {
    const ok = await setRecordingMeetingVideo(id, uid, body.meetingVideoUrl);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  const rec = await getRecordingForUser(id, uid);
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: rec._id.toString(),
    type: rec.type,
    title: rec.title,
    status: rec.status,
    messageCount: rec.messageCount,
    updatedAt: rec.updatedAt.toISOString(),
    meetingVideoUrl: rec.meetingVideoUrl ?? null,
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const deleted = await deleteRecording(id, new ObjectId(user.id));
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
