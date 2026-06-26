import { Hammer } from "lucide-react";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · RenovateConnect" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <section className="mx-auto flex min-h-[80svh] max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Hammer className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <span className="font-display text-lg font-bold">RenovateConnect</span>
      </div>
      <h1 className="font-serif text-3xl font-semibold">Create your account</h1>
      <p className="mt-1 mb-6 text-slate-500">Start managing your storefront.</p>
      <SignupForm redirectTo={next ?? "/"} />
    </section>
  );
}
