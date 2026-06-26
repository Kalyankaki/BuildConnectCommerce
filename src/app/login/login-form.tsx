"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithPassword, type AuthState } from "@/server/auth-actions";

const input = "w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInWithPassword, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {state.error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
        <input type="email" name="email" required autoComplete="email" className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
        <input type="password" name="password" required autoComplete="current-password" className={input} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-500">
        No account?{" "}
        <Link href="/signup" className="font-medium text-slate-900 underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
