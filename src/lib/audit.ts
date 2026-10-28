import "server-only";
import { db, newId, nowIso } from "@/lib/db";

export async function audit(actor: string, action: string, target: string, meta: Record<string, unknown> = {}) {
  try {
    await db().insert("audit_log", { id: newId(), actor, action, target, meta, created_at: nowIso() });
  } catch (e) {
    console.error("[plot twist] audit log write failed", e);
  }
}
