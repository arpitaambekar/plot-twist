"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/primitives";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";

export function ProfileForm({ name: initial, email }: { name: string; email: string }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/me", { method: "PATCH", json: { name } });
      toast("Profile updated.");
      router.refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="pf-name">Display name</Label>
        <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
      </div>
      <div>
        <Label htmlFor="pf-email">Email</Label>
        <Input id="pf-email" value={email} disabled readOnly />
      </div>
      <Button type="submit" loading={busy} disabled={!name.trim() || name === initial}>
        Save
      </Button>
    </form>
  );
}

/** Per-browser conveniences stored in localStorage. Keys are read by the Home and Research pages. */
export const PREF_KEYS = { newsView: "pt.pref.newsView", researchDepth: "pt.pref.researchDepth" } as const;

function read(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function Preferences() {
  const [newsView, setNewsView] = useState("grid");
  const [depth, setDepth] = useState("comprehensive");
  const toast = useToast();
  useEffect(() => {
    setNewsView(read(PREF_KEYS.newsView, "grid"));
    setDepth(read(PREF_KEYS.researchDepth, "comprehensive"));
  }, []);
  function set(key: string, value: string, apply: (v: string) => void) {
    apply(value);
    try {
      localStorage.setItem(key, value);
      toast("Preference saved on this browser.", "info");
    } catch {
      toast("Your browser blocked local storage, so this can't be remembered.", "error");
    }
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="pref-news">Default news view</Label>
        <Select id="pref-news" value={newsView} onChange={(e) => set(PREF_KEYS.newsView, e.target.value, setNewsView)}>
          <option value="grid">Grid</option>
          <option value="list">List</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="pref-depth">Default research depth</Label>
        <Select id="pref-depth" value={depth} onChange={(e) => set(PREF_KEYS.researchDepth, e.target.value, setDepth)}>
          <option value="comprehensive">Comprehensive research</option>
          <option value="quick">Quick overview</option>
        </Select>
      </div>
      <p className="text-[12px] text-muted sm:col-span-2">Stored in this browser only. Animations already follow your system&apos;s reduced-motion setting.</p>
    </div>
  );
}
