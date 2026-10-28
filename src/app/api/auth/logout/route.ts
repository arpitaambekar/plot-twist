import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { LOCAL_COOKIE, supabaseServerClient } from "@/lib/auth/session";

export async function POST() {
  if (env.supabaseConfigured) {
    const supabase = await supabaseServerClient();
    await supabase.auth.signOut();
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOCAL_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
