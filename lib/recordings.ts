import { ObjectId, type Collection } from "mongodb";
import { getDb } from "./mongodb";

export type InterviewType = "technical" | "behavioral";

export type RecordingStatus = "in_progress" | "completed";

export type RecordingWrite = {
  userId: ObjectId;
  type: InterviewType;
  title: string;
  status: RecordingStatus;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type RecordingDoc = RecordingWrite & { _id: ObjectId };

function recordingsCollection(db: Awaited<ReturnType<typeof getDb>>): Collection<RecordingWrite> {
  return db.collection<RecordingWrite>("recordings");
}

export async function ensureRecordingIndexes() {
  const db = await getDb();
  await recordingsCollection(db).createIndex({ userId: 1, updatedAt: -1 });
}

export function recordingTitle(type: InterviewType, createdAt: Date): string {
  const label = type === "technical" ? "Technical" : "Behavioral";
  return `${label} · ${createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

export async function createRecording(userId: ObjectId, type: InterviewType): Promise<ObjectId> {
  const db = await getDb();
  const now = new Date();
  const title = recordingTitle(type, now);
  const result = await recordingsCollection(db).insertOne({
    userId,
    type,
    title,
    status: "in_progress",
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return result.insertedId;
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
  
  // We use db.collection directly here to bypass strict TypeScript checking 
  // since we are adding a brand new "clips" array to the database!
  await db.collection("recordings").updateOne(
    { _id: oid, userId },
    { 
      $push: { clips: { videoUrl, question, createdAt: new Date() } } as any, 
      $set: { updatedAt: new Date() } 
    }
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
  
  // $pull tells MongoDB to find the clip with this exact URL and yank it out of the array
  await db.collection("recordings").updateOne(
    { _id: oid, userId },
    { $pull: { clips: { videoUrl } } as any }
  );
}