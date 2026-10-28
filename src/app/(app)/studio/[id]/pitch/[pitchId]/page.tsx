import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PitchEditor } from "@/components/studio/pitch-editor";

export const metadata = { title: "Pitch · Campaign Studio" };

export default async function PitchPage({ params }: { params: Promise<{ id: string; pitchId: string }> }) {
  const { id, pitchId } = await params;
  const pitch = await db().get("pitches", pitchId);
  if (!pitch) notFound();
  const idea = await db().get("campaign_ideas", pitch.idea_id);
  if (!idea || idea.set_id !== id) notFound();
  const set = await db().get("campaign_sets", id);
  const sources = pitch.source_ids.length ? await db().list("sources", { in: { column: "id", values: pitch.source_ids } }) : [];
  return <PitchEditor initialPitch={pitch} idea={idea} setId={id} boardHint={set?.brief.tourism_board ?? null} sources={sources} />;
}
