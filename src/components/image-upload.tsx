"use client";
/**
 * Image field: upload to Supabase Storage when configured, or paste a URL. Submits the final
 * URL via a hidden input named `name`, so it works inside any server-action form.
 * Requires a public Storage bucket (default "uploads") when uploading.
 */
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function ImageUpload({
  name,
  defaultValue = "",
  bucket = "uploads",
  label = "Image",
}: {
  name: string;
  defaultValue?: string;
  bucket?: string;
  label?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch (err) {
      setError(`Upload failed: ${(err as Error).message}. Paste a URL instead.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <input type="hidden" name={name} value={url} />
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-20 w-20 rounded-lg border object-cover" />
      )}
      {configured && (
        <input type="file" accept="image/*" onChange={onFile} disabled={busy} className="block text-sm" />
      )}
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://… (or upload above)"
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
      {busy && <p className="text-xs text-slate-500">Uploading…</p>}
      {error && <p className="text-xs text-amber-700">{error}</p>}
    </div>
  );
}
