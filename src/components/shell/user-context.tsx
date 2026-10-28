"use client";
import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/auth/session";
import type { IntegrationStatus } from "@/lib/env";
import type { Role } from "@/lib/types";

const rank: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

export const UserCtx = createContext<{ user: SessionUser; integrations: IntegrationStatus } | null>(null);

export function useSession() {
  const ctx = useContext(UserCtx);
  if (!ctx) throw new Error("useSession must be used inside AppShell");
  return { ...ctx, can: (r: Role) => rank[ctx.user.role] >= rank[r] };
}
