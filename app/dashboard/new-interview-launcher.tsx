"use client";

import { Button } from "@headlessui/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { lightPrimaryButton } from "@/lib/dashboard-light-theme";

type Props = {
  className?: string;
  label?: string;
};

/** Opens the mock interview page (mode is chosen there). */
export function NewInterviewLauncher({ className, label = "Mock interview" }: Props) {
  const router = useRouter();

  return (
    <Button
      type="button"
      onClick={() => {
        router.push("/dashboard/interview");
        router.refresh();
      }}
      className={clsx(lightPrimaryButton, className)}
    >
      {label}
    </Button>
  );
}
