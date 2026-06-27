import { resellerContextOrRedirect } from "@/server/reseller-data";
import { setCustomDomain, verifyCustomDomain } from "@/server/reseller-actions";
import { getDomainStatus, isVercelConfigured } from "@/server/vercel";

export const metadata = { title: "Custom domain" };

export default async function DomainPage() {
  const { tenant } = await resellerContextOrRedirect();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "renovateconnect.app";
  const status = tenant.customDomain ? await getDomainStatus(tenant.customDomain) : null;

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Custom domain</h1>
      <p className="mt-1 text-slate-500">
        Your storefront is always available at <code>{tenant.slug}.{rootDomain}</code>. Add your own
        domain to brand it fully.
      </p>

      <form action={setCustomDomain} className="mt-6 flex items-end gap-3 rounded-xl border bg-white p-4">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium">Custom domain</span>
          <input
            name="domain"
            defaultValue={tenant.customDomain ?? ""}
            placeholder="shop.yourbrand.com"
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save</button>
      </form>

      {tenant.customDomain && (
        <div className="mt-4 rounded-xl border bg-white p-5 text-sm">
          <p>
            Status:{" "}
            {tenant.customDomainVerified ? (
              <span className="font-medium text-green-700">Verified ✓</span>
            ) : (
              <span className="font-medium text-amber-700">Pending verification</span>
            )}
          </p>
          <div className="mt-3">
            <p className="font-medium">1. Add {status && status.records.length > 1 ? "these DNS records" : "this DNS record"} at your registrar:</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{status
  ? status.records.map((r) => `${r.type.padEnd(6)} ${r.name.padEnd(28)} ${r.value}`).join("\n")
  : `CNAME   ${tenant.customDomain}   ->   cname.vercel-dns.com`}
            </pre>
            {!isVercelConfigured() && (
              <p className="mt-2 text-xs text-slate-500">
                (Domain automation is off — set <code>VERCEL_TOKEN</code> + <code>VERCEL_PROJECT_ID</code>{" "}
                to attach &amp; verify domains automatically.)
              </p>
            )}
          </div>
          {!tenant.customDomainVerified && (
            <form action={verifyCustomDomain} className="mt-3">
              <button className="rounded-lg border px-4 py-2 hover:bg-slate-100">
                {isVercelConfigured() ? "Check verification" : "Verify now (dev)"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
