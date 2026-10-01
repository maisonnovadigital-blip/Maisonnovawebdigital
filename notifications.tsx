"use client";

import { Bell, CalendarClock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { api } from "@/lib/client/api";
import { formatRelative } from "@/lib/utils/text";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface Payload {
  items: NotificationItem[];
  unread: number;
  dueFollowUps: { id: string; name: string; city: string | null; nextFollowUpAt: string | null }[];
}

export function NotificationsMenu() {
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(() => {
    api<Payload>("/api/notifications")
      .then(setData)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const count = (data?.unread ?? 0) + (data?.dueFollowUps.length ?? 0);

  return (
    <Menu
      onOpenChange={(open) => {
        if (open) load();
        if (!open && data?.unread) {
          api("/api/notifications", { method: "POST", body: {} })
            .then(load)
            .catch(() => undefined);
        }
      }}
    >
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications (${count})`} className="relative">
          <Bell />
          {count > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">{count > 9 ? "9+" : count}</span>
          ) : null}
        </Button>
      </MenuTrigger>
      <MenuContent className="w-80 p-0">
        <div className="max-h-[70vh] overflow-y-auto p-1">
          {data?.dueFollowUps.length ? (
            <>
              <MenuLabel>Relances à faire</MenuLabel>
              {data.dueFollowUps.slice(0, 6).map((item) => (
                <Link key={item.id} href={`/prospects/${item.id}?tab=followups`} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-surface-2">
                  <CalendarClock className="mt-0.5 size-4 text-orange-500" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-ink">{item.name}</div>
                    <div className="text-xs text-ink-3">Relance prévue {formatRelative(item.nextFollowUpAt)}</div>
                  </div>
                </Link>
              ))}
              <MenuSeparator />
            </>
          ) : null}
          <MenuLabel>Notifications</MenuLabel>
          {data?.items.length ? (
            data.items.map((item) => (
              <Link key={item.id} href={item.link ?? "/dashboard"} className="block rounded-lg px-2.5 py-2 hover:bg-surface-2">
                <div className="flex items-center gap-2">
                  {!item.readAt ? <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label="Non lue" /> : null}
                  <span className="truncate text-[13px] font-medium text-ink">{item.title}</span>
                </div>
                {item.body ? <div className="mt-0.5 line-clamp-2 text-xs text-ink-3">{item.body}</div> : null}
                <div className="mt-0.5 text-[11px] text-ink-3">{formatRelative(item.createdAt)}</div>
              </Link>
            ))
          ) : (
            <div className="px-2.5 pb-3 pt-1 text-[13px] text-ink-3">Aucune notification pour le moment.</div>
          )}
        </div>
      </MenuContent>
    </Menu>
  );
}
