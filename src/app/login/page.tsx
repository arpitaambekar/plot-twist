import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/home";
  if (await getCurrentUser()) redirect(next);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Wordmark className="text-[34px]" />
        <p className="mt-1 text-muted">There&apos;s always another story.</p>
        <div className="mt-10 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <LoginForm mode={env.supabaseConfigured ? "google" : "local"} next={next} domains={env.allowedDomains} error={sp.error} />
        </div>
        <p className="mt-6 text-center text-[12px] text-muted">Internal tool. Access is limited to authorised team members.</p>
      </div>
    </main>
  );
}
