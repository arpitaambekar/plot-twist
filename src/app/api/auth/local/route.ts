import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { createLocalToken, emailAllowed, LOCAL_COOKIE } from "@/lib/auth/session";
import { burstLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

const Body = z.object({ email: z.string().email().max(200), name: z.string().min(1).max(100) });

export async function POST(req: Request) {
  if (env.supabaseConfigured) return NextResponse.json({ error: "Local sign-in is disabled when Supabase Auth is configured." }, { status: 403 });
  if (process.env.NODE_ENV === "production" && env.sessionSecret.startsWith("dev-only")) {
    return NextResponse.json({ error: "Set SESSION_SECRET before using local sign-in in production." }, { status: 503 });
  }
  try {
    burstLimit("login:" + (req.headers.get("x-forwarded-for") ?? "local"), 8, 8);
  } catch {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your name and a valid work email." }, { status: 400 });
  const { email, name } = parsed.data;
  if (!emailAllowed(email)) return NextResponse.json({ error: "This email domain is not authorised for plot twist." }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOCAL_COOKIE, createLocalToken({ email, name }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  await audit(email, "auth.login.local", email);
  return res;
}
