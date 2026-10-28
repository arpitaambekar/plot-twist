import { NextResponse } from "next/server";
import { emailAllowed, supabaseServerClient } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/home";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";
  if (!code) return NextResponse.redirect(new URL("/login?error=1", url.origin));
  const supabase = await supabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email || !emailAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=1", url.origin));
  }
  await audit(data.user.email, "auth.login.google", data.user.email);
  return NextResponse.redirect(new URL(next, url.origin));
}
