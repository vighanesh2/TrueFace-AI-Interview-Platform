"use client";

import dynamic from "next/dynamic";

const AuroraHero = dynamic(
  () => import("@/components/aurora-hero").then((m) => m.AuroraHero),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-gray-950" aria-hidden />,
  }
);

export function HomeClient() {
  return <AuroraHero />;
}
