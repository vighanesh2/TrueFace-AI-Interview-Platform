import type { Metadata } from "next";
import { AuroraHero } from "@/components/aurora-hero";

export const metadata: Metadata = {
  title: "TRUEFACE — Interview the Real You",
  description:
    "AI-powered mock interviews and fraud detection that measure skill, reveal authenticity, and make hiring trustworthy.",
};

export default function HomePage() {
  return <AuroraHero />;
}
