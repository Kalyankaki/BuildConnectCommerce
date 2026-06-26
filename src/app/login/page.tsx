import { Hammer } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · RenovateConnect" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <section className="mx-auto flex min-h-[80svh] max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Hammer className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <span className="font-display text-lg font-bold">RenovateConnect</span>
      </div>
      <h1 className="font-serif text-3xl font-semibold">Welcome back</h1>
      <p className="mt-1 mb-6 text-slate-500">Sign in to your account.</p>
      <LoginForm redirectTo={next ?? "/"} />
    </section>
  );
}
