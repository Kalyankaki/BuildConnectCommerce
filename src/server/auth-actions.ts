"use server";
/**
 * Auth actions backed by Supabase Auth (email + password).
 */
import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const credsSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  redirectTo: z.string().optional(),
});

export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credsSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    redirectTo: String(formData.get("redirectTo") ?? "/"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  redirect(parsed.data.redirectTo || "/");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credsSchema
    .extend({ fullName: z.string().optional() })
    .safeParse({
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      fullName: String(formData.get("fullName") ?? "").trim(),
      redirectTo: String(formData.get("redirectTo") ?? "/"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName || null } },
  });
  if (error) return { error: error.message };

  // If email confirmation is required, there's no session yet.
  if (!data.session) {
    return { message: "Check your email to confirm your account, then sign in." };
  }
  redirect(parsed.data.redirectTo || "/");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
