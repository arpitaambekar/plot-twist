import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureSeeded } from "@/lib/seed";
import { integrationStatus } from "@/lib/env";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await ensureSeeded();
  return (
    <AppShell user={user} integrations={integrationStatus()}>
      {children}
    </AppShell>
  );
}
