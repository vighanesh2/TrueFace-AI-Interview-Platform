import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { ensureRecordingIndexes, getRecordingByLiveSessionForUser } from "@/lib/recordings";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const liveSessionId = searchParams.get("liveSessionId")?.trim();
  if (!liveSessionId) {
    return NextResponse.json({ error: "liveSessionId required" }, { status: 400 });
  }
  try {
    await ensureRecordingIndexes();
  } catch (e) {
    console.error("Recording indexes:", e);
  }
  const rec = await getRecordingByLiveSessionForUser(liveSessionId, new ObjectId(user.id));
  if (!rec) {
    return NextResponse.json({ recording: null });
  }
  const msgs = rec.messages ?? [];
  return NextResponse.json({
    recording: {
      id: rec._id.toString(),
      title: rec.title,
      type: rec.type,
      status: rec.status,
      messageCount: rec.messageCount,
      candidateDisplayName: rec.candidateDisplayName ?? null,
      roleTitle: rec.roleTitle ?? null,
      updatedAt: rec.updatedAt.toISOString(),
      messages: msgs,
    },
  });
}
