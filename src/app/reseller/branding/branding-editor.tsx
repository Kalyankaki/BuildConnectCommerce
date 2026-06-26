"use client";

import { useState } from "react";
import { updateBranding } from "@/server/reseller-actions";
import { THEMES, getTheme, themeForPrimary } from "@/lib/themes";

const input = "w-full rounded-lg border px-3 py-2";

export function BrandingEditor({
  initial,
}: {
  initial: {
    displayName: string;
    primaryColor: string;
    secondaryColor: string;
    font: string;
    logoUrl: string;
    supportEmail: string;
  };
}) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [themeId, setThemeId] = useState(themeForPrimary(initial.primaryColor).id);
  const theme = getTheme(themeId);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form action={updateBranding} className="space-y-4">
        {/* Theme drives the saved colors */}
        <input type="hidden" name="primaryColor" value={theme.primary} />
        <input type="hidden" name="secondaryColor" value={theme.secondary} />

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Storefront name</span>
          <input name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} />
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium">Theme</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setThemeId(t.id)}
                className={`flex items-center gap-2 rounded-lg border-2 p-2 text-left transition ${
                  themeId === t.id ? "border-slate-900" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="flex">
                  <span className="h-6 w-6 rounded-l" style={{ backgroundColor: t.primary }} />
                  <span className="h-6 w-6 rounded-r" style={{ backgroundColor: t.secondary }} />
                </span>
                <span className="text-xs font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Logo URL</span>
          <input name="logoUrl" defaultValue={initial.logoUrl} placeholder="https://…" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Support email</span>
          <input type="email" name="supportEmail" defaultValue={initial.supportEmail} className={input} />
        </label>
        <input type="hidden" name="font" value={initial.font} />
        <button className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white">Save branding</button>
      </form>

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-500">Live preview</span>
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: theme.primary }}>
            <span className="font-semibold">{displayName || "Your storefront"}</span>
            <span className="text-xs opacity-90">Cart</span>
          </div>
          <div className="p-4">
            <div className="rounded-lg border p-4" style={{ borderColor: theme.secondary }}>
              <div className="font-medium">Sample product</div>
              <div className="text-sm text-slate-500">From $7.50 / sqft</div>
              <button className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: theme.primary }}>
                Get my installed price
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
