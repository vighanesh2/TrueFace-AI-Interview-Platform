"use client";

import { Button, Field, Fieldset, Input, Label, Legend } from "@headlessui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { AuthShell } from "@/components/auth-shell";
import {
  lightDescription,
  lightFieldsetPanel,
  lightInput,
  lightLabel,
  lightLegend,
  lightPrimaryButton,
} from "@/lib/dashboard-light-theme";

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
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-lg">
        <form onSubmit={onSubmit}>
          <Fieldset disabled={loading} className={clsx(lightFieldsetPanel, "sm:p-10")}>
            <Legend className={lightLegend}>Sign in</Legend>
            <p className={lightDescription}>
              Use the account you registered with. Sessions are stored server-side.
            </p>

            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <Field>
              <Label className={lightLabel}>Email</Label>
              <Input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={lightInput}
              />
            </Field>

            <Field>
              <Label className={lightLabel}>Password</Label>
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={lightInput}
              />
            </Field>

            <Field>
              <Button type="submit" disabled={loading} className={clsx(lightPrimaryButton, "mt-1 w-full")}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </Field>
          </Fieldset>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
          No account?{" "}
          <Link
            href="/register"
            className="font-semibold text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
          >
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
