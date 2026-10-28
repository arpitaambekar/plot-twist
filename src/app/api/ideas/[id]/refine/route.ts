import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { loadIdeaAndSet } from "@/lib/campaigns/access";
import { previewRefinement, REFINE_ACTIONS, type RefineAction } from "@/lib/campaigns/refine";
import { burstLimit } from "@/lib/security/rate-limit";

export const maxDuration = 300;

const Body = z.object({
  action: z.enum(Object.keys(REFINE_ACTIONS) as [RefineAction, ...RefineAction[]]),
  instruction: z.string().max(2000).default(""),
  allow_overwrite: z.boolean().default(false),
});

/** Returns a preview (before/after per field). Nothing is saved until the user applies it. */
export const POST = route<{ id: string }>("editor", async ({ params, req, user }) => {
  burstLimit(`refine:${user.id}`, 10, 6);
  const b = await parseBody(req, Body);
  if (b.action === "custom" && b.instruction.trim().length < 5) return Response.json({ error: "Describe the refinement you want.", code: "invalid" }, { status: 400 });
  const { idea, set } = await loadIdeaAndSet(params.id);
  const preview = await previewRefinement(idea, set, b.action, b.instruction, b.allow_overwrite, user.id);
  return { preview, base_version: idea.version };
});
