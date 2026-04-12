import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { getRecordingForUser } from "@/lib/recordings";

const BLOB_PREFIX = "meetings";

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getSessionUser();
        if (!user) {
          throw new Error("Unauthorized");
        }

        let recordingId: string | null = null;
        if (clientPayload) {
          try {
            const p = JSON.parse(clientPayload) as { recordingId?: string };
            recordingId = typeof p.recordingId === "string" ? p.recordingId : null;
          } catch {
            recordingId = null;
          }
        }
        if (!recordingId) {
          throw new Error("Missing recordingId");
        }

        const expected = `${BLOB_PREFIX}/${user.id}/${recordingId}.webm`;
        if (pathname !== expected) {
          throw new Error("Invalid upload path");
        }

        const rec = await getRecordingForUser(recordingId, new ObjectId(user.id));
        if (!rec) {
          throw new Error("Recording not found");
        }

        return {
          allowedContentTypes: ["video/webm", "video/x-matroska", "application/octet-stream"],
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({ recordingId }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    const status = msg === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
