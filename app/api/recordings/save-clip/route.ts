import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { addVideoClipToRecording, listRecordingsForUser, createRecording } from "@/lib/recordings";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const uid = new ObjectId(user.id);

  // 1. Find the user's most recent interview recording
  const recordings = await listRecordingsForUser(uid);
  let targetRecordingId;

  if (recordings.length > 0) {
     targetRecordingId = recordings[0]._id.toString();
  } else {
     // 2. Fallback: If they somehow don't have a recording, make one!
     const newId = await createRecording(uid, "behavioral");
     targetRecordingId = newId.toString();
  }

  // 3. Attach the video link to that interview!
  await addVideoClipToRecording(targetRecordingId, uid, body.videoUrl, body.question);

  return NextResponse.json({ success: true });
}