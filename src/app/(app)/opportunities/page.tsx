import { db } from "@/lib/db";
import { loadReadinessMap } from "@/lib/opportunities/load";
import { OpportunitiesView } from "@/components/opportunities/opportunities-view";

export const metadata = { title: "Opportunity Tracker" };

export default async function OpportunitiesPage() {
  const [opps, profiles, destinations] = await Promise.all([
    db().list("opportunities", { orderBy: { column: "updated_at" } }),
    db().list("profiles", { limit: 500 }),
    db().list("destinations", { orderBy: { column: "name", ascending: true } }),
  ]);
  const readiness = await loadReadinessMap(opps);
  return (
    <OpportunitiesView
      opportunities={opps}
      readiness={Object.fromEntries(Object.entries(readiness).map(([k, r]) => [k, { status: r.status, pct: r.pct, completed: r.completed, total: r.total, next: r.next ? (r.next.action?.label ?? r.next.label) : null }]))}
      owners={[...new Set(profiles.map((p) => p.name))]}
      destinations={destinations.map((d) => ({ name: d.name, board: d.tourism_board }))}
    />
  );
}
