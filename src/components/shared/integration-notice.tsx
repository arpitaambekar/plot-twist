"use client";
import Link from "next/link";
import { Notice } from "@/components/ui/primitives";
import { useSession } from "@/components/shell/user-context";

/** Transparent setup state when an integration a feature depends on is missing. */
export function IntegrationNotice({ needs }: { needs: ("ai" | "search")[] }) {
  const { integrations, user } = useSession();
  const missing = needs.filter((n) => (n === "ai" ? !integrations.ai : !integrations.search));
  if (!missing.length) return null;
  const names = missing.map((m) => (m === "ai" ? "an AI key (OPENAI_API_KEY or OPENROUTER_API_KEY)" : "a search provider (TAVILY_API_KEY or BRAVE_SEARCH_API_KEY)"));
  return (
    <Notice
      tone="peach"
      title="Setup needed before this can run"
      action={
        user.role === "admin" ? (
          <Link href="/admin" className="text-sm font-medium text-accent hover:underline">
            Open Admin
          </Link>
        ) : undefined
      }
    >
      This feature uses live research and needs {names.join(" and ")}. Nothing will be generated or made up until it is configured.
    </Notice>
  );
}
