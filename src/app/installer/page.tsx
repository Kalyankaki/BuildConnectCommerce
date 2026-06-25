import { installerContextOrRedirect, listAssignedJobs, type AssignedJob } from "@/server/installer-data";
import { completeOrder, setAppointmentStatus } from "@/server/installer-actions";
import { formatCents } from "@/lib/format";

export const metadata = { title: "My jobs" };

function fmt(d: Date | null) {
  return d ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d) : "TBD";
}

export default async function InstallerJobs() {
  const { tenant, session } = await installerContextOrRedirect();
  const jobs = await listAssignedJobs(tenant, session.profileId);

  // Group appointments by order.
  const byOrder = new Map<string, AssignedJob[]>();
  for (const j of jobs) {
    if (!byOrder.has(j.orderId)) byOrder.set(j.orderId, []);
    byOrder.get(j.orderId)!.push(j);
  }

  if (byOrder.size === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">My jobs</h1>
        <p className="mt-4 text-slate-500">No jobs assigned to you yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My jobs</h1>
      {[...byOrder.entries()].map(([orderId, appts]) => {
        const first = appts[0];
        const allDone = appts.every((a) => a.status === "completed");
        return (
          <div key={orderId} className="rounded-xl border bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">Order {orderId.slice(0, 8)}</div>
                <div className="text-sm text-slate-500">{first.customerEmail}</div>
                {first.address && (
                  <div className="text-sm text-slate-500">
                    {first.address.line1}, {first.address.city} {first.address.zip}
                  </div>
                )}
                <div className="mt-1 text-xs text-slate-400">Order status: {first.orderStatus}</div>
              </div>
              <div className="text-right text-sm text-slate-500">Balance {formatCents(first.balanceCents)}</div>
            </div>

            <ul className="mt-4 divide-y">
              {appts.map((a) => (
                <li key={a.appointmentId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <span className="font-medium capitalize">{a.type}</span>
                    <span className="ml-2 text-slate-500">{fmt(a.windowStart)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{a.status}</span>
                    {a.status === "scheduled" && (
                      <StatusBtn id={a.appointmentId} status="in_progress" label="Start" />
                    )}
                    {a.status === "in_progress" && (
                      <StatusBtn id={a.appointmentId} status="completed" label="Mark done" />
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {allDone && first.orderStatus === "in_progress" && (
              <form action={completeOrder} className="mt-4">
                <input type="hidden" name="orderId" value={orderId} />
                <button className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white">
                  Complete job &amp; charge balance ({formatCents(first.balanceCents)})
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBtn({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="appointmentId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-100">{label}</button>
    </form>
  );
}
