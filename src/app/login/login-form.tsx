"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input, Label, Notice } from "@/components/ui/primitives";
import { api } from "@/lib/client";

export function LoginForm({ mode, next, domains, error }: { mode: "google" | "local"; next: string; domains: string[]; error?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(error ? "Sign-in failed or your account is not authorised." : null);

  async function google() {
    setBusy(true);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: domains.length === 1 ? { hd: domains[0] } : undefined,
      },
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
    }
  }

  async function local(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("/api/auth/local", { json: { email, name } });
      window.location.href = next;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (mode === "google") {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Sign in</h1>
        {err && <Notice tone="danger">{err}</Notice>}
        <Button className="w-full" size="lg" onClick={google} loading={busy}>
          Continue with Google Workspace
        </Button>
        {domains.length > 0 && <p className="text-[12px] text-muted">Allowed domains: {domains.join(", ")}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={local} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Local sign-in</h1>
        <p className="mt-1 text-[13px] text-muted">Supabase Auth is not configured, so this development sign-in uses a signed session cookie. Configure Supabase for Google Workspace login in production.</p>
      </div>
      {err && <Notice tone="danger">{err}</Notice>}
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div>
        <Label htmlFor="email" hint={domains.length ? `(${domains.join(", ")})` : undefined}>
          Work email
        </Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <Button type="submit" className="w-full" size="lg" loading={busy}>
        Sign in
      </Button>
    </form>
  );
}
