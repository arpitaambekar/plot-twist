"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import type { Opportunity } from "@/lib/types";

export function NewOpportunity({ destinations }: { destinations: { name: string; board: string | null }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", destination: "", tourism_board: "", summary: "", priority: "Medium" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ opportunity: Opportunity }>("/api/opportunities", { json: { ...f, tourism_board: f.tourism_board || null } });
      toast("Opportunity created.");
      router.push(`/opportunities/${r.opportunity.id}`);
    } catch (err) {
      toast((err as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New opportunity
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="New opportunity" description="You can link research, campaigns, contacts and news afterwards.">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="no-name">Opportunity name</Label>
            <Input id="no-name" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Philippines secondary-islands push" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="no-dest">Destination</Label>
              <Input
                id="no-dest"
                required
                list="no-dest-list"
                value={f.destination}
                onChange={(e) => {
                  const d = destinations.find((x) => x.name.toLowerCase() === e.target.value.toLowerCase());
                  setF({ ...f, destination: e.target.value, tourism_board: d?.board && !f.tourism_board ? d.board : f.tourism_board });
                }}
              />
              <datalist id="no-dest-list">
                {destinations.map((d) => (
                  <option key={d.name} value={d.name} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="no-pri">Priority</Label>
              <Select id="no-pri" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="no-board">Tourism board</Label>
            <Input id="no-board" value={f.tourism_board} onChange={(e) => setF({ ...f, tourism_board: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="no-sum">Summary</Label>
            <Textarea id="no-sum" rows={3} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
