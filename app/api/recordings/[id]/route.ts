import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import {
  bumpRecordingMessageCount,
  getRecordingForUser,
  setRecordingCompleted,
  setRecordingMeetingVideo,
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
  return NextResponse.json({
    id: rec._id.toString(),
    type: rec.type,
    title: rec.title,
    status: rec.status,
    messageCount: rec.messageCount,
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
  let body: { messageDelta?: number; complete?: boolean; meetingVideoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const uid = new ObjectId(user.id);
  if (typeof body.messageDelta === "number" && body.messageDelta !== 0) {
    await bumpRecordingMessageCount(id, uid, body.messageDelta);
  }
  if (body.complete === true) {
    await setRecordingCompleted(id, uid);
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
