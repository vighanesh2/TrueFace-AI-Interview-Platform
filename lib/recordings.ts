import { randomBytes } from "crypto";
import { ObjectId, type Collection } from "mongodb";
import { getDb } from "./mongodb";

export type InterviewType = "technical" | "behavioral";

export type RecordingStatus = "in_progress" | "completed";

/** Text chat sessions vs saved Live Avatar mock interviews */
export type RecordingSource = "text_chat" | "live_avatar";

export type RecordingChatMessage = { role: string; text: string };

export type RecordingClip = { videoUrl: string; question: string; createdAt: Date };

export type RecordingWrite = {
  userId: ObjectId;
  type: InterviewType;
  title: string;
  status: RecordingStatus;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  /** Present on new rows; omitted on legacy docs. */
  source?: RecordingSource;
  /** Public Vercel Blob URL for a saved mock-interview video, when recorded */
  meetingVideoUrl?: string;
  /** Full transcript when saved from Live Avatar (or copied from text chat later). */
  messages?: RecordingChatMessage[];
  /** Optional per-question video clips (extended schema). */
  clips?: RecordingClip[];
  /** Set when this row backs a company "live interview" link; matches URL segment after `candidate_`. */
  liveSessionId?: string;
  /** Unauthenticated candidates pass this with `recordingId` so chat can bump counts safely. */
  liveBumpToken?: string;
  candidateDisplayName?: string;
  roleTitle?: string;
  jobDescriptionSnippet?: string;
};

export type RecordingDoc = RecordingWrite & { _id: ObjectId };

function recordingsCollection(db: Awaited<ReturnType<typeof getDb>>): Collection<RecordingWrite> {
  return db.collection<RecordingWrite>("recordings");
}

export async function ensureRecordingIndexes() {
  const db = await getDb();
  await recordingsCollection(db).createIndex({ userId: 1, updatedAt: -1 });
  await recordingsCollection(db).createIndex({ userId: 1, liveSessionId: 1 }, { sparse: true });
}

export function recordingTitle(type: InterviewType, createdAt: Date): string {
  const label = type === "technical" ? "Technical" : "Behavioral";
  return `${label} · ${createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

export async function createRecording(
  userId: ObjectId,
  type: InterviewType,
  options?: { source?: RecordingSource }
): Promise<ObjectId> {
  const db = await getDb();
  const now = new Date();
  const title = recordingTitle(type, now);
  const source: RecordingSource = options?.source ?? "text_chat";
  const result = await recordingsCollection(db).insertOne({
    userId,
    type,
    title,
    status: "in_progress",
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
    source,
  });
  return result.insertedId;
}

export type CreateLiveSessionOpts = {
  type: InterviewType;
  /** Same id as in `/live-interview/[sessionId]` (without `candidate_` prefix). */
  liveSessionId: string;
  candidateName?: string;
  roleTitle?: string;
  jobDescription?: string;
};

export async function createLiveSessionRecording(
  userId: ObjectId,
  opts: CreateLiveSessionOpts
): Promise<{ id: ObjectId; liveBumpToken: string }> {
  const db = await getDb();
  const now = new Date();
  const liveBumpToken = randomBytes(24).toString("hex");
  const cn = opts.candidateName?.trim();
  const rt = opts.roleTitle?.trim();
  const title = cn
    ? `Live · ${cn}${rt ? ` · ${rt}` : ""}`
    : recordingTitle(opts.type, now);
  const jd = opts.jobDescription?.trim();
  const result = await recordingsCollection(db).insertOne({
    userId,
    type: opts.type,
    title,
    status: "in_progress",
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
    liveSessionId: opts.liveSessionId,
    liveBumpToken,
    candidateDisplayName: cn || undefined,
    roleTitle: rt || undefined,
    jobDescriptionSnippet: jd && jd.length > 0 ? jd.slice(0, 4000) : undefined,
  });
  return { id: result.insertedId, liveBumpToken };
}

export async function getRecordingByLiveSessionForUser(
  liveSessionId: string,
  userId: ObjectId
): Promise<RecordingDoc | null> {
  const db = await getDb();
  const doc = await recordingsCollection(db).findOne({ userId, liveSessionId });
  if (!doc) return null;
  return doc as RecordingDoc;
}

/** Candidate link: load job context when `recordingId` + `liveBumpToken` match. */
export async function getRecordingForLiveCandidate(
  recordingId: string,
  liveBumpToken: string
): Promise<RecordingDoc | null> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return null;
  }
  if (!liveBumpToken || typeof liveBumpToken !== "string") return null;
  const db = await getDb();
  const doc = await recordingsCollection(db).findOne({ _id: oid, liveBumpToken });
  if (!doc) return null;
  return doc as RecordingDoc;
}

export async function bumpRecordingMessageCountByLiveToken(
  recordingId: string,
  liveBumpToken: string,
  delta: number
): Promise<boolean> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return false;
  }
  if (!liveBumpToken || typeof liveBumpToken !== "string") return false;
  const db = await getDb();
  const r = await recordingsCollection(db).updateOne(
    { _id: oid, liveBumpToken },
    { $inc: { messageCount: delta }, $set: { updatedAt: new Date() } }
  );
  return r.modifiedCount > 0;
}

export async function listRecordingsForUser(userId: ObjectId): Promise<RecordingDoc[]> {
  const db = await getDb();
  const rows = await recordingsCollection(db).find({ userId }).sort({ updatedAt: -1 }).toArray();
  return rows as RecordingDoc[];
}

export async function getRecordingForUser(
  recordingId: string,
  userId: ObjectId
): Promise<RecordingDoc | null> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return null;
  }
  const db = await getDb();
  const doc = await recordingsCollection(db).findOne({ _id: oid, userId });
  if (!doc) return null;
  return doc as RecordingDoc;
}

export async function bumpRecordingMessageCount(recordingId: string, userId: ObjectId, delta: number) {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return;
  }
  const db = await getDb();
  await recordingsCollection(db).updateOne(
    { _id: oid, userId },
    { $inc: { messageCount: delta }, $set: { updatedAt: new Date() } }
  );
}

export async function setRecordingCompleted(recordingId: string, userId: ObjectId) {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return;
  }
  const db = await getDb();
  await recordingsCollection(db).updateOne(
    { _id: oid, userId },
    { $set: { status: "completed" as RecordingStatus, updatedAt: new Date() } }
  );
}

export async function setRecordingMeetingVideo(
  recordingId: string,
  userId: ObjectId,
  meetingVideoUrl: string
): Promise<boolean> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return false;
  }
  const db = await getDb();
  const r = await recordingsCollection(db).updateOne(
    { _id: oid, userId },
    { $set: { meetingVideoUrl, updatedAt: new Date() } }
  );
  return r.matchedCount > 0;
}

export async function saveLiveAvatarTranscript(
  recordingId: string,
  userId: ObjectId,
  messages: RecordingChatMessage[]
): Promise<boolean> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return false;
  }
  const db = await getDb();
  const now = new Date();
  const count = messages.length;
  const res = await recordingsCollection(db).updateOne(
    { _id: oid, userId },
    {
      $set: {
        messages,
        messageCount: count,
        status: "completed" as RecordingStatus,
        updatedAt: now,
      },
    }
  );
  return res.matchedCount > 0;
}

export async function addVideoClipToRecording(
  recordingId: string,
  userId: ObjectId,
  videoUrl: string,
  question: string
) {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return;
  }
  const db = await getDb();
  await db.collection("recordings").updateOne(
    { _id: oid, userId },
    {
      $push: { clips: { videoUrl, question, createdAt: new Date() } },
      $set: { updatedAt: new Date() },
    } as unknown as import("mongodb").UpdateFilter<import("mongodb").Document>
  );
}

export async function removeVideoClipFromRecording(
  recordingId: string,
  userId: ObjectId,
  videoUrl: string
) {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return;
  }
  const db = await getDb();
  await db.collection("recordings").updateOne(
    { _id: oid, userId },
    {
      $pull: { clips: { videoUrl } },
      $set: { updatedAt: new Date() },
    } as unknown as import("mongodb").UpdateFilter<import("mongodb").Document>
  );
}

export async function deleteRecording(recordingId: string, userId: ObjectId): Promise<boolean> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(recordingId);
  } catch {
    return false;
  }
  const db = await getDb();
  const res = await recordingsCollection(db).deleteOne({ _id: oid, userId });
  return res.deletedCount > 0;
}
