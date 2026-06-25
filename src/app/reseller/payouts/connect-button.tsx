"use client";

import { useState, useTransition } from "react";
import { startConnectOnboarding } from "@/server/connect";

export function ConnectButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startConnectOnboarding();
            if (r.ok) window.location.href = r.url;
            else setError(r.error);
          })
        }
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Connecting…" : "Connect Stripe"}
      </button>
      {error && <p className="mt-2 text-sm text-amber-700">{error}</p>}
    </div>
  );
}
