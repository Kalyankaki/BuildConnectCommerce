import "server-only";
/**
 * Vercel API integration for custom-domain provisioning. Lets a reseller connect their own
 * domain: attach it to the project, surface the DNS records, and verify. Dormant until
 * VERCEL_TOKEN + VERCEL_PROJECT_ID are set (then it activates automatically).
 */
const API = "https://api.vercel.com";

function cfg() {
  return {
    token: process.env.VERCEL_TOKEN,
    projectId: process.env.VERCEL_PROJECT_ID,
    teamId: process.env.VERCEL_TEAM_ID, // optional
  };
}

export function isVercelConfigured(): boolean {
  const c = cfg();
  return Boolean(c.token && c.projectId);
}

function qs(): string {
  const { teamId } = cfg();
  return teamId ? `?teamId=${teamId}` : "";
}

async function vfetch(path: string, init?: RequestInit) {
  const { token } = cfg();
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
}

export interface DomainStatus {
  verified: boolean;
  records: DnsRecord[];
}

/** Attach a domain to the Vercel project. Safe to call repeatedly. */
export async function addProjectDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  const { projectId } = cfg();
  const res = await vfetch(`/v10/projects/${projectId}/domains${qs()}`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  // "domain already exists" on this project is fine.
  if (body?.error?.code === "domain_already_in_use" || res.status === 409) return { ok: true };
  return { ok: false, error: body?.error?.message ?? `Vercel error ${res.status}` };
}

/** Ask Vercel to re-check verification. */
export async function verifyProjectDomain(domain: string): Promise<boolean> {
  const { projectId } = cfg();
  const res = await vfetch(`/v9/projects/${projectId}/domains/${domain}/verify${qs()}`, { method: "POST" });
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data?.verified) return true;
  }
  const status = await getDomainStatus(domain);
  return status?.verified ?? false;
}

/** Current verification state + the DNS records the reseller must add. */
export async function getDomainStatus(domain: string): Promise<DomainStatus | null> {
  if (!isVercelConfigured()) return null;
  const { projectId } = cfg();
  const res = await vfetch(`/v9/projects/${projectId}/domains/${domain}${qs()}`, { method: "GET" });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;

  const records: DnsRecord[] = [];
  // Ownership-verification records (when the domain is hosted elsewhere).
  for (const v of data.verification ?? []) {
    if (v?.type && v?.domain && v?.value) records.push({ type: v.type, name: v.domain, value: v.value });
  }
  // Routing record: CNAME for a subdomain, A for an apex domain.
  const labels = domain.split(".");
  if (labels.length > 2) {
    records.push({ type: "CNAME", name: labels[0], value: "cname.vercel-dns.com" });
  } else {
    records.push({ type: "A", name: "@", value: "76.76.21.21" });
  }

  return { verified: Boolean(data.verified), records };
}
