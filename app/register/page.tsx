"use client";

import { Button, Description, Field, Fieldset, Input, Label, Legend } from "@headlessui/react";
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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"candidate" | "interviewer">("candidate");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Registration failed");
        return;
      }
      router.push("/login");
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
            <Legend className={lightLegend}>Create account</Legend>
            <p className={lightDescription}>
              Credentials are stored in MongoDB Atlas with hashed passwords.
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
              <Description className={lightDescription}>At least 8 characters.</Description>
              <Input
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={lightInput}
              />
            </Field>

            <Field>
              <Label className={lightLabel}>I am signing up as</Label>
              <Description className={lightDescription}>
                Candidates practice interviews; interviewers use hiring workflows (coming soon).
              </Description>
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value as "candidate" | "interviewer")}
                required
                className={clsx(lightInput, "cursor-pointer")}
                aria-label="Account role"
              >
                <option value="candidate">Candidate</option>
                <option value="interviewer">Interviewer</option>
              </select>
            </Field>

            <Field>
              <Button type="submit" disabled={loading} className={clsx(lightPrimaryButton, "mt-1 w-full")}>
                {loading ? "Creating…" : "Register"}
              </Button>
            </Field>
          </Fieldset>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
