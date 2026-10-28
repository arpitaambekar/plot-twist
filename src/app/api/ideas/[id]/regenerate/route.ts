import { route } from "@/lib/api";
import { loadIdeaAndSet } from "@/lib/campaigns/access";
import { regenerateIdea } from "@/lib/campaigns/generate";
import { burstLimit } from "@/lib/security/rate-limit";

export const maxDuration = 300;

/** Regenerates unlocked fields only; the previous version stays restorable in history. */
export const POST = route<{ id: string }>("editor", async ({ params, user }) => {
  burstLimit(`regen:${user.id}`, 6, 3);
  const { idea, set } = await loadIdeaAndSet(params.id);
  return { idea: await regenerateIdea(idea, set, user) };
});
