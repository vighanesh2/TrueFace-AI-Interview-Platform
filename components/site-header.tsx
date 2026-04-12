import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-neutral-800 bg-neutral-950 text-white backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-[1920px] items-center px-3 sm:h-16 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-0 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          <Image
            src="/trueface-logo.png"
            alt="TrueFace"
            width={200}
            height={200}
            className="h-10 w-10 shrink-0 sm:h-16 sm:w-16"
            priority
          />
          <span className="-ml-0.5 text-lg font-semibold tracking-tight sm:-ml-1 sm:text-2xl">TrueFace</span>
        </Link>
      </div>
    </header>
  );
}
