import { ObjectId } from "mongodb";
import { notFound, redirect } from "next/navigation";
import InterviewChat from "../../interview-chat";
import { getSessionUser } from "@/lib/auth";
import { getRecordingForUser } from "@/lib/recordings";

type Props = { params: Promise<{ recordingId: string }> };

export default async function InterviewRecordingPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const { recordingId } = await params;
  const rec = await getRecordingForUser(recordingId, new ObjectId(user.id));
  if (!rec) {
    notFound();
  }
  return (
    <InterviewChat
      userEmail={user.email}
      recordingId={recordingId}
      interviewType={rec.type}
      recordingTitle={rec.title}
      meetingVideoUrl={rec.meetingVideoUrl ?? null}
    />
  );
}
