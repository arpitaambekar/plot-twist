import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureSeeded } from "@/lib/seed";
import { integrationStatus } from "@/lib/env";
import { AppShell } from "@/components/shell/app-shell";
import { resumeStaleJobsSoon } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await ensureSeeded();
  // No scheduler runs on a laptop: pick up research that was interrupted when the app last stopped.
  resumeStaleJobsSoon();
  return (
    <AppShell user={user} integrations={integrationStatus()}>
      {children}
    </AppShell>
  );
}
