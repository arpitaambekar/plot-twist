import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { db, nowIso } from "@/lib/db";
import type { Profile, Role } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mode: "supabase" | "local";
}

export const LOCAL_COOKIE = "pt_session";
const ROLE_RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function emailAllowed(email: string): boolean {
  const domains = env.allowedDomains;
  if (!domains.length) return true;
  const d = email.toLowerCase().split("@")[1] ?? "";
  return domains.includes(d);
}

/* ---------------- local signed-cookie sessions (development / no Supabase) */

function sign(payload: string): string {
  return crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

export function createLocalToken(user: { email: string; name: string }): string {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readLocalToken(token: string | undefined): { email: string; name: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { email: String(data.email), name: String(data.name) };
  } catch {
    return null;
  }
}

/* ---------------- profiles & roles */

async function ensureProfile(id: string, email: string, name: string): Promise<Profile> {
  const store = db();
  const existing = await store.get("profiles", id);
  if (existing) return existing;
  const all = await store.list("profiles", { limit: 1 });
  // First user, or anyone in ADMIN_EMAILS, becomes admin; everyone else starts as editor.
  const role: Role = !all.length || env.adminEmails.includes(email.toLowerCase()) ? "admin" : "editor";
  return store.insert("profiles", { id, email, name, role, created_at: nowIso() });
}

export async function supabaseServerClient() {
  const jar = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by middleware instead.
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (env.supabaseConfigured) {
    const supabase = await supabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (!u?.email || !emailAllowed(u.email)) return null;
    const name = (u.user_metadata?.full_name as string) || u.email.split("@")[0];
    const profile = await ensureProfile(u.id, u.email, name);
    return { id: u.id, email: u.email, name: profile.name, role: profile.role, mode: "supabase" };
  }
  const jar = await cookies();
  const local = readLocalToken(jar.get(LOCAL_COOKIE)?.value);
  if (!local || !emailAllowed(local.email)) return null;
  const id = "local-" + crypto.createHash("sha256").update(local.email.toLowerCase()).digest("hex").slice(0, 16);
  const profile = await ensureProfile(id, local.email, local.name);
  return { id, email: local.email, name: profile.name, role: profile.role, mode: "local" };
}

export async function requireUser(minRole: Role = "viewer"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Please sign in to continue.");
  if (ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
    throw new AuthError(403, `This action needs ${minRole} access. Your role is ${user.role}.`);
  }
  return user;
}

export function hasRole(user: SessionUser | null, minRole: Role) {
  return Boolean(user && ROLE_RANK[user.role] >= ROLE_RANK[minRole]);
}
