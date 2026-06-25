import { adminContextOrRedirect, listInstallersAdmin } from "@/server/admin-data";

export const metadata = { title: "Installers" };

export default async function AdminInstallers() {
  await adminContextOrRedirect();
  const installers = await listInstallersAdmin();

  return (
    <div>
      <h1 className="text-2xl font-bold">Installer directory</h1>
      {installers.length === 0 ? (
        <p className="mt-4 text-slate-500">No installers yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-slate-500">
              <tr>
                <th className="p-3">Installer</th>
                <th className="p-3">Tenant</th>
                <th className="p-3">Coverage ZIPs</th>
              </tr>
            </thead>
            <tbody>
              {installers.map((i) => (
                <tr key={`${i.profileId}-${i.tenantName}`} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{i.name ?? i.email}</div>
                    <div className="text-xs text-slate-500">{i.email}</div>
                  </td>
                  <td className="p-3">{i.tenantName}</td>
                  <td className="p-3 text-slate-500">
                    {i.coverageZips.length ? i.coverageZips.join(", ") : "all"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
