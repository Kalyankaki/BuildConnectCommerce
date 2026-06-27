import {
  adminContextOrRedirect,
  listServicesAdmin,
  listTaxRulesAdmin,
  listVerticalsAdmin,
  listZonesAdmin,
} from "@/server/admin-data";
import { createService, createTaxRule, createZone } from "@/server/admin-actions";
import { formatCents } from "@/lib/format";

export const metadata = { title: "Services & zones" };
const input = "w-full rounded-lg border px-3 py-2 text-sm";

export default async function AdminServices() {
  await adminContextOrRedirect();
  const [svcs, zones, tax, verticalList] = await Promise.all([
    listServicesAdmin(),
    listZonesAdmin(),
    listTaxRulesAdmin(),
    listVerticalsAdmin(),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Services &amp; zones</h1>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Services</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {svcs.map((s) => (
              <li key={s.service.id} className="flex justify-between">
                <span>{s.verticalName} · {s.service.type}</span>
                <span className="text-slate-500">
                  {s.service.pricingModel} · base {formatCents(s.service.baseCents)} · unit {formatCents(s.service.perUnitCents)}
                </span>
              </li>
            ))}
          </ul>
          <form action={createService} className="mt-4 grid grid-cols-2 gap-2">
            <select name="verticalId" className={input + " col-span-2"} required>
              <option value="">Vertical…</option>
              {verticalList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <select name="type" className={input}><option value="delivery">delivery</option><option value="labor">labor</option><option value="haulaway">haulaway</option></select>
            <select name="pricingModel" className={input}><option value="flat">flat</option><option value="per_unit">per_unit</option><option value="per_area">per_area</option><option value="quote">quote</option></select>
            <input name="baseCents" type="number" placeholder="base (cents)" className={input} />
            <input name="perUnitCents" type="number" placeholder="per-unit (cents)" className={input} />
            <button className="col-span-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Add service</button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Delivery zones</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {zones.map((z) => (
                <li key={z.id} className="flex justify-between">
                  <span>{z.zip}</span>
                  <span className="text-slate-500">
                    fee {formatCents(z.deliveryFeeCents)} · ×{(z.laborMultiplierBps / 10000).toFixed(2)} · {z.leadTimeDays}d
                  </span>
                </li>
              ))}
            </ul>
            <form action={createZone} className="mt-4 grid grid-cols-2 gap-2">
              <input name="zip" placeholder="ZIP" className={input} />
              <input name="deliveryFeeCents" type="number" placeholder="fee (cents)" className={input} />
              <input name="laborMultiplierBps" type="number" placeholder="labor bps (10000=1x)" defaultValue={10000} className={input} />
              <input name="leadTimeDays" type="number" placeholder="lead days" defaultValue={7} className={input} />
              <button className="col-span-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save zone</button>
            </form>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Tax rules</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {tax.map((t) => (
                <li key={t.id} className="flex justify-between">
                  <span>{t.zip}</span>
                  <span className="text-slate-500">{(t.rateBps / 100).toFixed(2)}%</span>
                </li>
              ))}
            </ul>
            <form action={createTaxRule} className="mt-4 grid grid-cols-2 gap-2">
              <input name="zip" placeholder="ZIP" className={input} />
              <input name="rateBps" type="number" placeholder="rate bps (875=8.75%)" className={input} />
              <button className="col-span-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save tax</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
