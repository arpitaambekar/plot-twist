import { route } from "@/lib/api";
import { burstLimit } from "@/lib/security/rate-limit";
import { startNewsRefresh } from "@/lib/news/refresh";
import { audit } from "@/lib/audit";

export const maxDuration = 300;

export const POST = route("editor", async ({ user }) => {
  burstLimit(`news-refresh:${user.id}`, 3, 2);
  const job = await startNewsRefresh(user.id);
  await audit(user.email, "news.refresh", job.id);
  return { job };
});
