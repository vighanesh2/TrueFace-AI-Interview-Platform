import Image from "next/image";
import Link from "next/link";
import { NewInterviewLauncher } from "./new-interview-launcher";

export default function DashboardHomePage() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-12 sm:px-10 sm:py-16">
      <p className="text-2xl" aria-hidden>
        👋
      </p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
        Hello there! Welcome back.
      </h1>
      <div className="mt-6 space-y-4 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
        <p>
          You&apos;re in your{" "}
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
            TRUEFACE workspace
          </span>
          . Run{" "}
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
            technical
          </span>{" "}
          or{" "}
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
            behavioral
          </span>{" "}
          mock interviews, then review every session from{" "}
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
            Recordings
          </span>
          .
        </p>
        <p>
          Pick up where you left off or start fresh—each session is tracked so you can build toward measurable readiness
          and trustworthy hiring signals.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-md dark:border-neutral-700 dark:bg-neutral-900/40 dark:shadow-neutral-950/50">
        <Image
          src="/homepage.png"
          alt="Live mock interview: AI interviewer, subtitles, and meeting controls"
          width={1920}
          height={1080}
          className="h-auto w-full object-cover object-top"
          sizes="(max-width: 896px) 100vw, 896px"
          priority
        />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <NewInterviewLauncher />
        <Link
          href="/dashboard/recordings"
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Go to recordings
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
