"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ClaimStatusBadge } from "@/components/sources/status-badge";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import type { ClaimStatus } from "@/lib/types";

interface Row {
  id: string;
  label?: string;
  name?: string;
  status?: ClaimStatus;
  previous: ClaimStatus;
  reason?: string;
  error?: string;
}

/** Bulk source check: runs live searches and updates statuses from evidence that was actually found. */
export function VerifyAllButton({ endpoint, pending, creditsEach, what, size = "sm" }: { endpoint: string; pending: number; creditsEach: number; what: string; size?: "sm" | "md" }) {
  const { can, integrations } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  if (!can("editor") || pending === 0) return null;

  async function run() {
    setBusy(true);
    try {
      const r = await api<{ checked: number; results: Row[] }>(endpoint, { method: "POST" });
      setRows(r.results);
      const up = r.results.filter((x) => x.status && x.status !== x.previous).length;
      toast(`Checked ${r.checked}. ${up} status${up === 1 ? "" : "es"} updated from evidence.`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size={size} onClick={() => { setRows(null); setOpen(true); }}>
        <ShieldCheck className="h-4 w-4" /> Check all sources
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)} title={`Check sources for ${pending} ${what}`} wide={Boolean(rows)}>
        {!rows ? (
          <div className="space-y-4 text-sm text-ink/80">
            <p>
              plot twist. searches the web for each item and reads the pages it finds. A status only improves when the evidence is actually there:
              <strong> Verified</strong> needs an official source, <strong>Corroborated</strong> needs two independent sources. Nothing is downgraded because a search came up empty.
            </p>
            <p className="text-muted">
              Uses about {pending * creditsEach} search credits and takes 1 to 3 minutes. {integrations.demoFixtures && "Demo fixtures are on, so statuses won't change."}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={run} loading={busy} disabled={!integrations.search}>
                {busy ? "Checking sources…" : "Start checking"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{r.label ?? r.name}</p>
                  {r.status && <ClaimStatusBadge status={r.status} />}
                </div>
                <p className="mt-1 text-[13px] text-muted">{r.error ? `Could not check: ${r.error}` : r.reason}</p>
              </div>
            ))}
            <p className="text-[12px] text-muted">Anything still marked Needs Verification can be confirmed by hand: open the source and use the buttons on each item.</p>
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
