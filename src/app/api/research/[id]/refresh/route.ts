import { route } from "@/lib/api";
import { refreshReport } from "@/lib/research/service";

export const POST = route<{ id: string }>("editor", async ({ user, params }) => refreshReport(user, params.id));
