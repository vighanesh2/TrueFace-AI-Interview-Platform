"use client";

import { Button, Field, Fieldset, Input, Label, Legend } from "@headlessui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  descriptionClass,
  fieldsetPanel,
  inputClass,
  labelClass,
  legendTitle,
  primaryButtonClass,
} from "@/lib/fieldset-theme";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Login failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8 bg-gray-950 text-white font-sans">
      <div className="w-full max-w-lg px-4">
        <form onSubmit={onSubmit}>
          <Fieldset disabled={loading} className={fieldsetPanel}>
            <Legend className={legendTitle}>Sign in</Legend>
            <p className={descriptionClass}>
              Use the account you registered with. Sessions are stored server-side.
            </p>

            {error ? (
              <p className="text-sm/6 text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <Field>
              <Label className={labelClass}>Email</Label>
              <Input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field>
              <Label className={labelClass}>Password</Label>
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </Field>

            <Field>
              <Button type="submit" disabled={loading} className={clsx(primaryButtonClass, "mt-1 w-full")}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </Field>
          </Fieldset>
        </form>

        <p className="mt-6 text-center text-sm/6 text-white/50">
          No account?{" "}
          <Link href="/register" className="font-medium text-white/80 hover:text-white underline-offset-2 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
