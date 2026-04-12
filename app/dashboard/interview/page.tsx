import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveAvatarInterview } from "@/components/live-avatar-interview";

export const metadata: Metadata = {
  title: "Mock Interview",
};

export default function DashboardLiveInterviewPage() {
  return (
    <div className="flex min-h-[calc(100dvh-1px)] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <Suspense
        fallback={
          <div className="min-h-[min(780px,calc(100dvh-9rem))] animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
        }
      >
        <LiveAvatarInterview />
      </Suspense>
    </div>
  );
}
