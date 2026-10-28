import "server-only";
import { db, newId, nowIso } from "@/lib/db";
import type { CampaignContent, CampaignIdea, ImageRef } from "@/lib/types";
import { CAMPAIGN_FIELDS } from "@/lib/types";
import type { AiIdea } from "./schemas";
import { BANNED_TITLES } from "./schemas";

/** Fields a person may edit by hand (and which AI may change only when unlocked). */
export const EDITABLE_FIELDS: string[] = [...CAMPAIGN_FIELDS.map(([k]) => k), "summary", "research_notes"];

export function toContent(ai: AiIdea, claimIds: string[]): CampaignContent {
  const { research_refs: _r, photo_subject: _p, ...rest } = ai;
  void _r;
  void _p;
  return { ...rest, dependency_flags: dedupeFlags(ai.dependency_flags), research_claim_ids: claimIds };
}

function dedupeFlags(flags: string[]) {
  return [...new Set(flags.map((f) => f.trim()).filter(Boolean))].slice(0, 6);
}

export function isBannedTitle(name: string) {
  const n = name.toLowerCase();
  return BANNED_TITLES.some((b) => n.includes(b));
}

export function normName(s: string) {
  return s.toLowerCase().replace(/\[demo\]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function addRevision(idea: CampaignIdea, action: string, author: string) {
  await db().insert("campaign_revisions", {
    id: newId("rev_"),
    idea_id: idea.id,
    version: idea.version,
    content: idea.content,
    locked_fields: idea.locked_fields,
    action,
    author,
    created_at: nowIso(),
  });
}

export async function createIdea(input: {
  set_id: string;
  destination: string;
  content: CampaignContent;
  report_id: string | null;
  report_version: number | null;
  origin: CampaignIdea["origin"];
  parent_ids?: string[];
  merge_notes?: string | null;
  image: ImageRef | null;
  author: { id: string; name: string };
  is_demo: boolean;
  action: string;
}): Promise<CampaignIdea> {
  const idea: CampaignIdea = {
    id: newId("idea_"),
    set_id: input.set_id,
    report_id: input.report_id,
    report_version: input.report_version,
    destination: input.destination,
    content: input.content,
    status: "draft",
    locked_fields: [],
    origin: input.origin,
    parent_ids: input.parent_ids ?? [],
    merge_notes: input.merge_notes ?? null,
    reviewer: null,
    approval_note: null,
    image: input.image,
    version: 1,
    created_by: input.author.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    is_demo: input.is_demo,
  };
  await db().insert("campaign_ideas", idea);
  await addRevision(idea, input.action, input.author.name);
  return idea;
}

/**
 * Apply field changes to an idea and record a revision.
 * `manual` edits lock the touched fields so AI never overwrites them silently.
 */
export async function applyChanges(
  idea: CampaignIdea,
  changes: Partial<CampaignContent>,
  opts: { manual: boolean; action: string; author: string; extra?: Partial<CampaignIdea> },
): Promise<CampaignIdea> {
  const touched = Object.keys(changes).filter((k) => JSON.stringify((idea.content as unknown as Record<string, unknown>)[k]) !== JSON.stringify((changes as Record<string, unknown>)[k]));
  if (!touched.length && !opts.extra) return idea;
  const content = { ...idea.content, ...changes };
  const locked = opts.manual ? [...new Set([...idea.locked_fields, ...touched.filter((t) => EDITABLE_FIELDS.includes(t))])] : idea.locked_fields;
  const updated = (await db().update("campaign_ideas", idea.id, {
    content,
    locked_fields: locked,
    version: idea.version + 1,
    updated_at: nowIso(),
    ...(opts.extra ?? {}),
  })) as CampaignIdea;
  await addRevision(updated, opts.action, opts.author);
  return updated;
}
