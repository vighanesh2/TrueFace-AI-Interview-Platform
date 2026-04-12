import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coding mock interview — TRUEFACE",
  description: "LiveAvatar session with LangGraph brain, Monaco editor, and practice tests.",
};

export default function CodeInterviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
