"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Newspaper,
  Compass,
  Sparkles,
  Users,
  KanbanSquare,
  Library,
  Bookmark,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ShieldCheck,
  Menu,
  FlaskConical,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import type { IntegrationStatus } from "@/lib/env";
import { Wordmark } from "@/components/brand/wordmark";
import { GlobalSearch } from "./global-search";
import { UserCtx } from "./user-context";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/home", label: "Home", icon: Newspaper },
  { href: "/research", label: "Destination Research", icon: Compass },
  { href: "/studio", label: "Campaign Studio", icon: Sparkles },
  { href: "/contacts", label: "Tourism Board Contacts", icon: Users },
  { href: "/opportunities", label: "Opportunity Tracker", icon: KanbanSquare },
  { href: "/library", label: "Campaign Library", icon: Library },
];
const SECONDARY = [
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ user, integrations, children }: { user: SessionUser; integrations: IntegrationStatus; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("pt.sidebar") === "collapsed");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem("pt.sidebar", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const items = [...NAV, ...SECONDARY, ...(user.role === "admin" ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : [])];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const navLink = (item: (typeof items)[number]) => (
    <Link
      key={item.href}
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[14px] transition-colors",
        isActive(item.href) ? "bg-soft-blue font-medium text-accent" : "text-ink/75 hover:bg-ink/[0.04] hover:text-ink",
        collapsed && "lg:justify-center lg:px-0",
      )}
    >
      <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} aria-hidden />
      <span className={cn("truncate", collapsed && "lg:sr-only")}>{item.label}</span>
    </Link>
  );

  return (
    <UserCtx.Provider value={{ user, integrations }}>
      <div className="flex min-h-screen">
        {mobileOpen && <div className="fixed inset-0 z-30 bg-ink/25 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-ivory transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            collapsed ? "lg:w-[68px]" : "lg:w-60",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
          aria-label="Main navigation"
        >
          <div className={cn("flex h-16 items-center justify-between px-4", collapsed && "lg:justify-center lg:px-0")}>
            <Link href="/home" className={cn(collapsed && "lg:hidden")}>
              <Wordmark className="text-[21px]" />
            </Link>
            {collapsed && (
              <Link href="/home" className="hidden text-[22px] font-semibold lg:block" aria-label="plot twist. home">
                p<span className="text-accent">.</span>
              </Link>
            )}
            <button onClick={toggle} className={cn("hidden rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink lg:block", collapsed && "lg:hidden")} aria-label="Collapse sidebar">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-2">
            {NAV.map(navLink)}
            <div className="my-3 border-t border-line" />
            {SECONDARY.map(navLink)}
            {user.role === "admin" && navLink({ href: "/admin", label: "Admin", icon: ShieldCheck })}
          </nav>
          <div className="border-t border-line p-3">
            {collapsed && (
              <button onClick={toggle} className="mb-2 hidden w-full justify-center rounded-md p-1.5 text-muted hover:bg-ink/5 lg:flex" aria-label="Expand sidebar">
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <div className={cn("flex items-center gap-2.5", collapsed && "lg:flex-col")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white" aria-hidden>
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
                <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
                <p className="truncate text-[12px] capitalize text-muted">{user.role}</p>
              </div>
              <button onClick={logout} className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Sign out" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-ivory/85 px-4 backdrop-blur-md md:px-8">
            <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-ink lg:hidden" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-2">
              {integrations.demoFixtures && (
                <span className="hidden items-center gap-1 rounded-full bg-soft-danger px-2.5 py-1 text-[12px] font-medium text-danger sm:inline-flex" title="Offline demo fixtures are on. Results are not real research.">
                  <FlaskConical className="h-3.5 w-3.5" /> Demo fixtures on
                </span>
              )}
              {(!integrations.ai || !integrations.search) && !integrations.demoFixtures && (
                <Link href={user.role === "admin" ? "/admin" : "/settings"} className="hidden rounded-full bg-soft-peach px-2.5 py-1 text-[12px] font-medium text-peach-ink sm:inline-flex">
                  Setup needed: {[!integrations.ai && "AI", !integrations.search && "Search"].filter(Boolean).join(" + ")}
                </Link>
              )}
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </UserCtx.Provider>
  );
}
