import { ObjectId } from "mongodb";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getRecordingForUser, type RecordingSource } from "@/lib/recordings";
import { RecordingReviewClient } from "./recording-review-client";

type Props = { params: Promise<{ id: string }> };

export default async function RecordingReviewPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const { id } = await params;
  const rec = await getRecordingForUser(id, new ObjectId(user.id));
  if (!rec) {
    notFound();
  }
  const source = (rec as { source?: RecordingSource }).source ?? "text_chat";
  if (source !== "live_avatar") {
    redirect(`/interview/${id}`);
  }
  return <RecordingReviewClient recordingId={id} />;
}
