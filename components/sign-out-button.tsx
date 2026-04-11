"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

type Props = {
  className?: string;
  children?: ReactNode;
};

export function SignOutButton({ className, children = "Sign out" }: Props) {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <button type="button" onClick={() => void signOut()} className={className}>
      {children}
    </button>
  );
}
