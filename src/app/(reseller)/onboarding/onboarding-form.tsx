"use client";

import { useActionState } from "react";
import { provisionTenant, type ProvisionState } from "@/server/provisioning";

type VerticalOption = { slug: string; name: string; icon: string | null };

const initialState: ProvisionState = { ok: false };

export function OnboardingForm({
  verticals,
  rootDomain,
}: {
  verticals: VerticalOption[];
  rootDomain: string;
}) {
  const [state, formAction, isPending] = useActionState(provisionTenant, initialState);

  if (state.ok && state.slug) {
    const url = `http://${state.slug}.${rootDomain}`;
    return (
      <div className="mt-8 rounded-xl border border-green-300 bg-green-50 p-6">
        <h2 className="text-lg font-semibold text-green-900">Your storefront is live 🎉</h2>
        <p className="mt-2 text-green-800">
          Visit{" "}
          <a className="font-medium underline" href={url}>
            {state.slug}.{rootDomain}
          </a>
        </p>
        <p className="mt-2 text-sm text-green-700">
          (Next step in M4: connect Stripe to start collecting payouts.)
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state.error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <fieldset className="space-y-4">
        <legend className="font-semibold">Brand</legend>
        <Field label="Storefront name">
          <input name="displayName" required className={inputClass} placeholder="Acme Remodel" />
        </Field>
        <Field label="Subdomain">
          <div className="flex items-center gap-2">
            <input
              name="slug"
              required
              pattern="[a-z0-9-]+"
              className={inputClass}
              placeholder="acme"
            />
            <span className="text-sm text-slate-500">.{rootDomain}</span>
          </div>
        </Field>
        <div className="flex gap-6">
          <Field label="Primary color">
            <input type="color" name="primaryColor" defaultValue="#0f172a" className="h-10 w-20" />
          </Field>
          <Field label="Secondary color">
            <input type="color" name="secondaryColor" defaultValue="#64748b" className="h-10 w-20" />
          </Field>
        </div>
        <Field label="Support email">
          <input type="email" name="supportEmail" className={inputClass} placeholder="help@acme.com" />
        </Field>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-semibold">Product lines</legend>
        <p className="text-sm text-slate-500">Pick the verticals your storefront will sell.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {verticals.map((v) => (
            <label key={v.slug} className="flex items-center gap-2 rounded-lg border p-3">
              <input type="checkbox" name="verticalSlugs" value={v.slug} />
              <span>
                {v.icon ?? "🔧"} {v.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-semibold">Pricing &amp; coverage</legend>
        <Field label="Markup over list (%)">
          <input
            type="number"
            name="markupPercent"
            min={0}
            step={0.5}
            defaultValue={20}
            className={inputClass}
          />
        </Field>
        <Field label="Coverage ZIP codes (comma-separated)">
          <input name="coverageZips" className={inputClass} placeholder="98036, 98037, 98101" />
        </Field>
      </fieldset>

      <fieldset className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
        <legend className="px-1 font-semibold text-slate-600">Payments</legend>
        Stripe Connect onboarding happens after launch (M4). Skipped for now.
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create storefront"}
      </button>
    </form>
  );
}

const inputClass = "w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
