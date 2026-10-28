import { route, notFound } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = route<{ id: string }>("viewer", async ({ params }) => {
  const article = await db().get("news_articles", params.id);
  if (!article) throw notFound("Story");
  return { article };
});
