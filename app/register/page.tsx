"use client";

import { Button, Description, Field, Fieldset, Input, Label, Legend } from "@headlessui/react";
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

export default function RegisterPage() {
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
    <main className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8 bg-gray-950 text-white font-sans">
      <div className="w-full max-w-lg px-4">
        <form onSubmit={onSubmit}>
          <Fieldset disabled={loading} className={fieldsetPanel}>
            <Legend className={legendTitle}>Create account</Legend>
            <p className={descriptionClass}>
              Credentials are stored in MongoDB Atlas with hashed passwords.
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
              <Description className={descriptionClass}>At least 8 characters.</Description>
              <Input
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </Field>

            <Field>
              <Button type="submit" disabled={loading} className={clsx(primaryButtonClass, "mt-1 w-full")}>
                {loading ? "Creating…" : "Register"}
              </Button>
            </Field>
          </Fieldset>
        </form>

        <p className="mt-6 text-center text-sm/6 text-white/50">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-white/80 hover:text-white underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
