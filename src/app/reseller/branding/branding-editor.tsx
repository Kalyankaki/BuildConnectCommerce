"use client";

import { useState } from "react";
import { updateBranding } from "@/server/reseller-actions";

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
  const [primaryColor, setPrimary] = useState(initial.primaryColor);
  const [secondaryColor, setSecondary] = useState(initial.secondaryColor || "#64748b");

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form action={updateBranding} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Storefront name</span>
          <input name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} />
        </label>
        <div className="flex gap-6">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Primary</span>
            <input type="color" name="primaryColor" value={primaryColor} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-20" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Secondary</span>
            <input type="color" name="secondaryColor" value={secondaryColor} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-20" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Logo URL</span>
          <input name="logoUrl" defaultValue={initial.logoUrl} placeholder="https://…" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Font</span>
          <input name="font" defaultValue={initial.font} placeholder="(optional)" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Support email</span>
          <input type="email" name="supportEmail" defaultValue={initial.supportEmail} className={input} />
        </label>
        <button className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white">Save branding</button>
      </form>

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-500">Live preview</span>
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: primaryColor }}>
            <span className="font-semibold">{displayName || "Your storefront"}</span>
            <span className="text-xs opacity-90">Cart</span>
          </div>
          <div className="p-4">
            <div className="rounded-lg border p-4" style={{ borderColor: secondaryColor }}>
              <div className="font-medium">Sample product</div>
              <div className="text-sm text-slate-500">From $7.50 / sqft</div>
              <button className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                Get my installed price
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
