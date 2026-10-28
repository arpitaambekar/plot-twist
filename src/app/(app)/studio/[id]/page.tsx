import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Workspace } from "@/components/studio/workspace";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const set = await db().get("campaign_sets", id);
  return { title: set ? `${set.destination} · Campaign Studio` : "Campaign Studio" };
}

export default async function StudioSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const set = await db().get("campaign_sets", id);
  if (!set) notFound();
  return (
    <Suspense>
      <Workspace setId={id} />
    </Suspense>
  );
}
