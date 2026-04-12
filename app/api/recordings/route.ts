import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import {
  createLiveSessionRecording,
  createRecording,
  ensureRecordingIndexes,
  listRecordingsForUser,
  type InterviewType,
  type RecordingSource,
} from "@/lib/recordings";

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
      source: (r as { source?: RecordingSource }).source ?? "text_chat",
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      meetingVideoUrl: r.meetingVideoUrl ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    type?: string;
    source?: string;
    liveSessionId?: string;
    candidateName?: string;
    role?: string;
    jobDescription?: string;
  };
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
  const uid = new ObjectId(user.id);

  if (typeof body.liveSessionId === "string" && body.liveSessionId.trim().length > 0) {
    const { id, liveBumpToken } = await createLiveSessionRecording(uid, {
      type: type as InterviewType,
      liveSessionId: body.liveSessionId.trim(),
      candidateName: typeof body.candidateName === "string" ? body.candidateName : undefined,
      roleTitle: typeof body.role === "string" ? body.role : undefined,
      jobDescription: typeof body.jobDescription === "string" ? body.jobDescription : undefined,
    });
    return NextResponse.json({ id: id.toString(), type, liveBumpToken }, { status: 201 });
  }

  const source: RecordingSource = body.source === "live_avatar" ? "live_avatar" : "text_chat";
  const id = await createRecording(uid, type as InterviewType, { source });
  const idStr = id.toString();
  return NextResponse.json(
    {
      id: idStr,
      type,
      meetingBlobPath: `meetings/${user.id}/${idStr}.webm`,
    },
    { status: 201 }
  );
}
