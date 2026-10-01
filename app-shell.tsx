"use client";

import { Building2, LayoutDashboard, Menu as MenuIcon, MessageSquareText, Radar, Settings, Sparkles, SquareKanban, ChartColumn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { NovaLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { cn } from "@/lib/utils/cn";
import { GlobalSearch } from "./global-search";
import { NotificationsMenu } from "./notifications";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { useWorkspace, WorkspaceProvider } from "./workspace";

export interface ShellProps {
  user: { name: string; email: string; role: string };
  integrations: { places: "google" | "osm"; ai: boolean; pagespeed: boolean; websearch: boolean; smtp: boolean };
  dueFollowUps: number;
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospection", label: "Prospection", icon: Radar },
  { href: "/prospects", label: "Prospects", icon: Building2 },
  { href: "/messages", label: "Messages", icon: MessageSquareText },
  { href: "/crm", label: "CRM", icon: SquareKanban },
  { href: "/statistiques", label: "Statistiques", icon: ChartColumn },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

function NavLinks({ dueFollowUps, onNavigate }: { dueFollowUps: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Navigation principale">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors",
              active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-line" : "text-ink-2 hover:bg-surface/70 hover:text-ink",
            )}
          >
            <Icon className={cn("size-4 transition-colors", active ? "text-brand" : "text-ink-3 group-hover:text-ink-2")} />
            {item.label}
            {item.href === "/crm" && dueFollowUps > 0 ? (
              <span className="ml-auto rounded-full bg-orange-100 px-1.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" title="Relances dues">
                {dueFollowUps}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function IntegrationSummary({ integrations }: { integrations: ShellProps["integrations"] }) {
  const items = [
    { label: integrations.places === "google" ? "Google Places" : "OpenStreetMap", ok: true },
    { label: integrations.ai ? "Nova AI (Claude)" : "IA : mode règles", ok: integrations.ai },
    { label: "PageSpeed", ok: integrations.pagespeed },
  ];
  return (
    <Link href="/parametres/configuration" className="block rounded-xl border border-line bg-surface/60 p-3 transition hover:bg-surface">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Intégrations</div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-xs text-ink-2">
            <span className={cn("size-1.5 rounded-full", item.ok ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600")} aria-hidden />
            {item.label}
            <span className="sr-only">{item.ok ? "active" : "non configurée"}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-1.5">
      <NovaLogo className="size-8" />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-ink">Nova Web</div>
        <div className="text-[11px] text-ink-3">Prospector</div>
      </div>
    </Link>
  );
}

function ShellInner({ user, integrations, dueFollowUps, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openAssistant } = useWorkspace();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line bg-bg px-3 py-5 lg:flex">
        <Brand />
        <NavLinks dueFollowUps={dueFollowUps} />
        <div className="mt-auto">
          <IntegrationSummary integrations={integrations} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left" title="Navigation" hideTitle>
        <div className="flex h-full flex-col gap-6 bg-bg px-3 py-5">
          <Brand />
          <NavLinks dueFollowUps={dueFollowUps} onNavigate={() => setMobileOpen(false)} />
          <div className="mt-auto">
            <IntegrationSummary integrations={integrations} />
          </div>
        </div>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
            <MenuIcon />
          </Button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => openAssistant()} className="gap-1.5">
              <Sparkles className="text-brand" />
              <span className="hidden sm:inline">Nova AI</span>
            </Button>
            <NotificationsMenu />
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <AssistantPanel aiEnabled={integrations.ai} />
    </div>
  );
}

export function AppShell(props: ShellProps) {
  return (
    <WorkspaceProvider>
      <ShellInner {...props} />
    </WorkspaceProvider>
  );
}
