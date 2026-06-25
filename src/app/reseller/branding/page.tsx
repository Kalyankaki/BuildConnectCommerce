import { resellerContextOrRedirect } from "@/server/reseller-data";
import { BrandingEditor } from "./branding-editor";

export const metadata = { title: "Branding" };

export default async function BrandingPage() {
  const { tenant } = await resellerContextOrRedirect();
  return (
    <div>
      <h1 className="text-2xl font-bold">Branding</h1>
      <p className="mt-1 text-slate-500">Changes apply to your live storefront immediately.</p>
      <div className="mt-6">
        <BrandingEditor
          initial={{
            displayName: tenant.displayName,
            primaryColor: tenant.primaryColor,
            secondaryColor: tenant.secondaryColor ?? "",
            font: tenant.font ?? "",
            logoUrl: tenant.logoUrl ?? "",
            supportEmail: tenant.supportEmail ?? "",
          }}
        />
      </div>
    </div>
  );
}
