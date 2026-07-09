"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/actions/auth";

type Mode = "login" | "signup";

export default function AuthForm({
  mode,
  action,
}: {
  mode: Mode;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );

  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isSignup && (
        <Field
          label="Name"
          name="name"
          type="text"
          placeholder="Ada Lovelace"
          autoComplete="name"
          errors={state?.fieldErrors?.name}
        />
      )}
      <Field
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        errors={state?.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        placeholder={isSignup ? "At least 8 characters" : "••••••••"}
        autoComplete={isSignup ? "new-password" : "current-password"}
        errors={state?.fieldErrors?.password}
      />

      {state?.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {pending
          ? "Please wait…"
          : isSignup
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to LinkStash?{" "}
            <Link href="/signup" className="text-accent hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  autoComplete,
  errors,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
  errors?: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="rounded-lg border border-line bg-surface px-3 py-2.5 text-fg outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      {errors?.map((e) => (
        <span key={e} className="text-xs text-red-600 dark:text-red-400">
          {e}
        </span>
      ))}
    </label>
  );
}
