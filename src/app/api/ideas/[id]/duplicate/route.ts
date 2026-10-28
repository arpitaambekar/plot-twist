import { route } from "@/lib/api";
import { loadIdeaAndSet } from "@/lib/campaigns/access";
import { createIdea } from "@/lib/campaigns/service";

export const POST = route<{ id: string }>("editor", async ({ params, user }) => {
  const { idea } = await loadIdeaAndSet(params.id);
  const copy = await createIdea({
    set_id: idea.set_id,
    destination: idea.destination,
    content: { ...idea.content, name: `${idea.content.name} (copy)` },
    report_id: idea.report_id,
    report_version: idea.report_version,
    origin: "duplicated",
    parent_ids: [idea.id],
    image: idea.image,
    author: user,
    is_demo: idea.is_demo,
    action: `Duplicated from "${idea.content.name}" v${idea.version}`,
  });
  return { idea: copy };
});
