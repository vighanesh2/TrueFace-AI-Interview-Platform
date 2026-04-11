"use client";

import dynamic from "next/dynamic";
import InterviewChat from "./interview-chat";

const AuroraHero = dynamic(
  () => import("@/components/aurora-hero").then((m) => m.AuroraHero),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-gray-950" aria-hidden />,
  }
);

type Props = { userEmail: string | null };

export function HomeClient({ userEmail }: Props) {
  if (userEmail) {
    return <InterviewChat userEmail={userEmail} />;
  }
  return <AuroraHero />;
}
