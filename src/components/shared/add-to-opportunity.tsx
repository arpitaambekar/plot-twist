"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import type { Opportunity } from "@/lib/types";
import type { OpportunityLinksInput } from "@/lib/opportunities/links";
import { useSession } from "@/components/shell/user-context";
import { cn } from "@/lib/utils";

/**
 * "Add to Opportunity Tracker" from anywhere: creates a new opportunity, or links the item to an
 * existing one, carrying destination, board, evidence and work across without re-entry.
 */
export function AddToOpportunity({
  defaults,
  links,
  label = "Add to Opportunity Tracker",
  variant = "secondary",
  size = "md",
  className,
}: {
  defaults: { name: string; destination: string; tourism_board?: string | null; summary?: string };
  links: OpportunityLinksInput;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md";
  className?: string;
}) {
  const { can } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [list, setList] = useState<Opportunity[]>([]);
  const [target, setTarget] = useState("");
  const [form, setForm] = useState({ name: defaults.name, destination: defaults.destination, tourism_board: defaults.tourism_board ?? "", summary: defaults.summary ?? "", priority: "Medium" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Opportunity | null>(null);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    api<{ items: Opportunity[] }>("/api/opportunities")
      .then((r) => {
        setList(r.items);
        const match = r.items.find((o) => o.destination.toLowerCase() === defaults.destination.toLowerCase());
        if (match) {
          setTarget(match.id);
          setMode("existing");
        } else setTarget(r.items[0]?.id ?? "");
      })
      .catch(() => setList([]));
  }, [open, defaults.destination]);

  async function submit() {
    setBusy(true);
    try {
      const r =
        mode === "new"
          ? await api<{ opportunity: Opportunity }>("/api/opportunities", { json: { ...form, tourism_board: form.tourism_board || null, ...links } })
          : await api<{ opportunity: Opportunity }>(`/api/opportunities/${target}/link`, { json: links });
      setDone(r.opportunity);
      toast(mode === "new" ? "Opportunity created." : "Linked to opportunity.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!can("editor")) return null;

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} className={className}>
        <KanbanSquare className="h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Add to Opportunity Tracker" description="Everything linked here stays connected to the opportunity record.">
        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-ink">
              Saved to <strong>{done.name}</strong>. It now links {done.news_ids.length} news item(s), {done.report_id ? "a research report" : "no report yet"}, {done.idea_ids.length} campaign(s) and {done.contact_ids.length} contact(s).
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Link href={`/opportunities/${done.id}`} className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
                Open opportunity
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-line p-0.5 text-sm" role="tablist">
              {(["new", "existing"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  disabled={m === "existing" && !list.length}
                  onClick={() => setMode(m)}
                  className={cn("rounded-full px-3.5 py-1.5 disabled:opacity-40", mode === m ? "bg-ink text-white" : "text-ink/70")}
                >
                  {m === "new" ? "New opportunity" : `Add to existing (${list.length})`}
                </button>
              ))}
            </div>
            {mode === "new" ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="opp-name">Opportunity name</Label>
                  <Input id="opp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="opp-dest">Destination</Label>
                    <Input id="opp-dest" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="opp-pri">Priority</Label>
                    <Select id="opp-pri" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="opp-board">Tourism board</Label>
                  <Input id="opp-board" value={form.tourism_board} onChange={(e) => setForm({ ...form, tourism_board: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="opp-sum">Summary</Label>
                  <Textarea id="opp-sum" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="opp-target">Opportunity</Label>
                <Select id="opp-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                  {list.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} · {o.destination} · {o.stage}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} loading={busy} disabled={mode === "new" ? form.name.length < 2 || !form.destination : !target}>
                {mode === "new" ? "Create opportunity" : "Link to opportunity"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
