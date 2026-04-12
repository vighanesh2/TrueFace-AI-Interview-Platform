"use client";

import { Button, Dialog, DialogBackdrop, DialogPanel, Field, Fieldset, Legend } from "@headlessui/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  lightChoiceCard,
  lightDescription,
  lightFieldsetPanel,
  lightLegend,
  lightLabel,
  lightPrimaryButton,
  lightSecondaryButton,
} from "@/lib/dashboard-light-theme";

type Props = {
  className?: string;
  label?: string;
};

export function NewInterviewLauncher({ className, label = "+ New interview" }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [interviewType, setInterviewType] = useState<"technical" | "behavioral">("technical");
  const [creating, setCreating] = useState(false);

  const startInterview = async () => {
    if (interviewType === "technical") {
      setDialogOpen(false);
      router.push("/dashboard/interview");
      router.refresh();
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: interviewType }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setDialogOpen(false);
      router.push(`/interview/${data.id}`);
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={clsx(lightPrimaryButton, className)}
      >
        {label}
      </Button>

      <Dialog open={dialogOpen} onClose={setDialogOpen} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-neutral-900/40 transition data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in dark:bg-black/60"
        />
        <div className="fixed inset-0 z-50 flex min-h-full items-center justify-center p-4">
          <DialogPanel
            transition
            className="w-full max-w-lg transform transition data-closed:scale-95 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
          >
            <Fieldset className={lightFieldsetPanel}>
              <Legend className={lightLegend}>New interview</Legend>
              <p className={lightDescription}>Choose how you want to practice. You can start another session anytime.</p>

              <Field>
                <span className={lightLabel}>Interview type</span>
                <p className={lightDescription}>Technical depth first, or behavioral (STAR-style) rounds.</p>
                <div className="mt-3 space-y-3" role="group" aria-label="Interview type">
                  <button
                    type="button"
                    onClick={() => setInterviewType("technical")}
                    className={lightChoiceCard(interviewType === "technical")}
                  >
                    <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Technical interview</span>
                    <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                      Coding, systems, and follow-ups that go deeper as you demonstrate mastery.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterviewType("behavioral")}
                    className={lightChoiceCard(interviewType === "behavioral")}
                  >
                    <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Behavioral interview</span>
                    <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                      STAR/CAR-style prompts, reflection, and consistency under follow-up questions.
                    </span>
                  </button>
                </div>
              </Field>

              <Field className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  disabled={creating}
                  className={clsx(lightSecondaryButton, "w-full sm:w-auto")}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void startInterview()}
                  disabled={creating}
                  className={clsx(lightPrimaryButton, "w-full sm:w-auto sm:min-w-[140px]")}
                >
                  {creating ? "Starting…" : "Start session"}
                </Button>
              </Field>
            </Fieldset>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
