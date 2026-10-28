import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { integrationStatus } from "@/lib/env";
import { Card, PageHeader, SectionTitle, Badge } from "@/components/ui/primitives";
import { IntegrationPanel } from "@/components/admin/integration-panel";
import { ProfileForm, Preferences } from "@/components/admin/settings-forms";

export const metadata = { title: "Settings" };

const ROLE_COPY = {
  admin: "Full access, including integrations, users and usage limits.",
  editor: "Can run research, generate and edit campaigns, and manage opportunities and contacts.",
  viewer: "Read-only access. You can still save items for yourself.",
};

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;
  const watch = await db().list("watchlist", { where: { user_id: user.id } as never });
  const byKind = watch.reduce<Record<string, number>>((a, w) => ((a[w.kind] = (a[w.kind] ?? 0) + 1), a), {});
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Your account" title="Settings" subtitle="Your profile, preferences and the platform's connection status." />
      <div className="space-y-6">
        <Card className="p-6">
          <SectionTitle title="Profile" />
          <ProfileForm name={user.name} email={user.email} />
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
            <span className="text-muted">Role</span>
            <Badge tone={user.role === "admin" ? "ink" : user.role === "editor" ? "blue" : "neutral"} className="capitalize">
              {user.role}
            </Badge>
            <span className="text-[13px] text-muted">{ROLE_COPY[user.role]}</span>
          </div>
          <p className="mt-2 text-[12px] text-muted">Sign-in: {user.mode === "supabase" ? "Google Workspace via Supabase" : "Local development sign-in"}. Roles are managed by admins.</p>
        </Card>

        <Card className="p-6">
          <SectionTitle title="Watchlist" action={<Link href="/home" className="text-sm font-medium text-accent hover:underline">Manage on Home</Link>} />
          {watch.length ? (
            <div className="space-y-2 text-sm">
              <p className="text-ink/80">
                You follow {watch.length} item{watch.length === 1 ? "" : "s"}:{" "}
                {Object.entries(byKind)
                  .map(([k, n]) => `${n} ${k.replace("_", " ")}${n === 1 ? "" : "s"}`)
                  .join(", ")}
                .
              </p>
              <div className="flex flex-wrap gap-1.5">
                {watch.slice(0, 20).map((w) => (
                  <Badge key={w.id}>{w.value}</Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">You are not following any destinations, boards or categories yet. Follow them from Home to surface new developments there.</p>
          )}
        </Card>

        <Card className="p-6">
          <SectionTitle title="Display preferences" />
          <Preferences />
        </Card>

        <Card className="p-6">
          <SectionTitle title="Integration status" kicker="Read-only" action={user.role === "admin" ? <Link href="/admin" className="text-sm font-medium text-accent hover:underline">Open Admin</Link> : undefined} />
          <IntegrationPanel status={integrationStatus()} />
        </Card>
      </div>
    </div>
  );
}
