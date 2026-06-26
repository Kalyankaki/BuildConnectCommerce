"use client";

import { useState } from "react";
import { useActionState } from "react";
import { provisionTenant, type ProvisionState } from "@/server/provisioning";
import { formatCents } from "@/lib/format";

type Item = { variantId: string; productName: string; sku: string; listCents: number; uom: string };
type Group = { id: string; name: string; icon: string | null; items: Item[] };
type Theme = { id: string; name: string; primary: string; secondary: string };

const initialState: ProvisionState = { ok: false };
const input = "w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300";

export function OnboardingForm({
  catalog,
  themes,
  rootDomain,
}: {
  catalog: Group[];
  themes: Theme[];
  rootDomain: string;
}) {
  const [state, formAction, isPending] = useActionState(provisionTenant, initialState);
  const [themeId, setThemeId] = useState(themes[0]?.id ?? "midnight");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleGroup(group: Group, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      group.items.forEach((it) => (on ? next.add(it.variantId) : next.delete(it.variantId)));
      return next;
    });
  }

  if (state.ok && state.slug) {
    return (
      <div className="mt-8 rounded-xl border border-green-300 bg-green-50 p-6">
        <h2 className="text-lg font-semibold text-green-900">Your storefront is live 🎉</h2>
        <a
          href={`/store/${state.slug}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 font-medium text-white hover:bg-green-600"
        >
          Visit your storefront →
        </a>
        <p className="mt-3 text-sm text-green-800">
          Your store URL: <span className="font-medium">/store/{state.slug}</span>
        </p>
        <p className="mt-1 text-xs text-green-700">
          A custom domain ({state.slug}.{rootDomain}) is an optional upgrade you can connect later.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-8">
      {state.error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{state.error}</p>
      )}

      {/* Brand */}
      <fieldset className="space-y-4">
        <legend className="font-semibold">Brand</legend>
        <Field label="Storefront name">
          <input name="displayName" required className={input} placeholder="Acme Remodel" />
        </Field>
        <Field label="Subdomain / store slug">
          <div className="flex items-center gap-2">
            <input name="slug" required pattern="[a-z0-9-]+" className={input} placeholder="acme" />
            <span className="text-sm text-slate-500">/store/…</span>
          </div>
        </Field>
        <Field label="Support email">
          <input type="email" name="supportEmail" className={input} placeholder="help@acme.com" />
        </Field>
      </fieldset>

      {/* Theme */}
      <fieldset className="space-y-3">
        <legend className="font-semibold">Theme</legend>
        <input type="hidden" name="themeId" value={themeId} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {themes.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setThemeId(t.id)}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                themeId === t.id ? "border-slate-900" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="flex">
                <span className="h-7 w-7 rounded-l-md" style={{ backgroundColor: t.primary }} />
                <span className="h-7 w-7 rounded-r-md" style={{ backgroundColor: t.secondary }} />
              </span>
              <span className="text-sm font-medium">{t.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Items */}
      <fieldset className="space-y-4">
        <legend className="font-semibold">Products to resell</legend>
        <p className="text-sm text-slate-500">
          Selected {selected.size} item{selected.size === 1 ? "" : "s"}. Pick at least one.
        </p>
        {catalog.map((group) => {
          const allOn = group.items.every((it) => selected.has(it.variantId));
          return (
            <div key={group.id} className="rounded-xl border">
              <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
                <span className="font-medium">
                  {group.icon} {group.name}
                </span>
                <button
                  type="button"
                  onClick={() => toggleGroup(group, !allOn)}
                  className="text-xs font-medium text-slate-600 underline"
                >
                  {allOn ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-2">
                {group.items.map((it) => (
                  <label key={it.variantId} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <span className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="variantIds"
                        value={it.variantId}
                        checked={selected.has(it.variantId)}
                        onChange={() => toggle(it.variantId)}
                      />
                      {it.productName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatCents(it.listCents)}
                      {it.uom === "each" ? "" : `/${it.uom}`}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </fieldset>

      {/* Pricing & coverage */}
      <fieldset className="space-y-4">
        <legend className="font-semibold">Pricing &amp; coverage</legend>
        <Field label="Markup over list (%)">
          <input type="number" name="markupPercent" min={0} step={0.5} defaultValue={20} className={input} />
        </Field>
        <Field label="Coverage ZIP codes (comma-separated)">
          <input name="coverageZips" className={input} placeholder="98036, 98037, 98101" />
        </Field>
      </fieldset>

      <button
        type="submit"
        disabled={isPending || selected.size === 0}
        className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create storefront"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
