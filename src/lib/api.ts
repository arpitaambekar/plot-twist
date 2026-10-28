import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type z, type ZodTypeAny } from "zod";
import { AuthError, requireUser, type SessionUser } from "@/lib/auth/session";
import { NotConfiguredError } from "@/lib/env";
import { RateLimitError } from "@/lib/security/rate-limit";
import type { Role } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Ctx<P> = { user: SessionUser; params: P; req: Request };

/**
 * Wraps a route handler with authentication, role checks and consistent JSON errors.
 * Error bodies are { error, code } so the UI can show proper setup / permission states.
 */
export function route<P = Record<string, string>>(minRole: Role, handler: (ctx: Ctx<P>) => Promise<Response | unknown>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const user = await requireUser(minRole);
      const params = (ctx?.params ? await ctx.params : {}) as P;
      const out = await handler({ user, params, req });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message, code: e.status === 401 ? "unauthenticated" : "forbidden" }, { status: e.status });
  if (e instanceof NotConfiguredError)
    return NextResponse.json({ error: e.message, code: "not_configured", integration: e.integration }, { status: 503 });
  if (e instanceof RateLimitError) return NextResponse.json({ error: e.message, code: "rate_limited" }, { status: 429 });
  if (e instanceof ZodError)
    return NextResponse.json({ error: "Some fields are invalid: " + e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "), code: "invalid" }, { status: 400 });
  if (e instanceof HttpError) return NextResponse.json({ error: e.message, code: "http" }, { status: e.status });
  console.error("[plot twist] unhandled error", e);
  return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong.", code: "server_error" }, { status: 500 });
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
  return schema.parse(json);
}

export function notFound(what = "Item") {
  return new HttpError(404, `${what} not found.`);
}
