import { Suspense } from "react";
import { LiveInterviewCandidate } from "@/components/live-interview-candidate";

type Props = { params: Promise<{ sessionId: string }> };

export default async function LiveInterviewPage({ params }: Props) {
  const { sessionId } = await params;
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={<div className="min-h-96 animate-pulse rounded-xl bg-neutral-900" />}>
        <LiveInterviewCandidate sessionId={sessionId} />
      </Suspense>
    </div>
  );
}
