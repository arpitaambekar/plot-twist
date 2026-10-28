import "server-only";
import { db } from "@/lib/db";
import { notFound } from "@/lib/api";

export async function loadIdeaAndSet(id: string) {
  const idea = await db().get("campaign_ideas", id);
  if (!idea) throw notFound("Campaign idea");
  const set = await db().get("campaign_sets", idea.set_id);
  if (!set) throw notFound("Campaign set");
  return { idea, set };
}
