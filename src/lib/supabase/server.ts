import "server-only";
/**
 * Supabase server client (App Router). Reads/writes the auth cookies. Cookie writes only
 * succeed inside Server Actions / Route Handlers; in Server Components the setAll is a no-op
 * (session refresh happens in proxy.ts).
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — ignore; proxy.ts refreshes the session cookies.
        }
      },
    },
  });
}
