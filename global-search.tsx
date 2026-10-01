"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/prospects/badges";
import { Kbd } from "@/components/ui/controls";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils/cn";

interface Result {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  status: string;
  potentialScore: number | null;
}

export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ results: Result[] }>(`/api/prospects?quick=${encodeURIComponent(term.trim())}`, { signal: controller.signal })
        .then((data) => {
          setResults(data.results);
          setActive(0);
        })
        .catch(() => undefined);
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const go = (id: string) => {
    setOpen(false);
    setTerm("");
    router.push(`/prospects/${id}`);
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        ref={inputRef}
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
          if (event.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          if (event.key === "Enter") {
            if (results[active]) go(results[active].id);
            else if (term.trim()) router.push(`/prospects?q=${encodeURIComponent(term.trim())}`);
          }
          if (event.key === "Escape") inputRef.current?.blur();
        }}
        placeholder="Rechercher un prospect…"
        aria-label="Rechercher un prospect"
        className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-12 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/15"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">
        <Kbd>Ctrl K</Kbd>
      </span>
      {open && term.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl animate-scale-in">
          {results.length ? (
            results.map((result, index) => (
              <button
                key={result.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(result.id)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", index === active ? "bg-surface-2" : "hover:bg-surface-2")}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{result.name}</div>
                  <div className="truncate text-xs text-ink-3">{[result.category, result.city].filter(Boolean).join(" · ")}</div>
                </div>
                <StatusBadge status={result.status} />
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-ink-3">Aucun prospect. Entrée pour chercher dans le tableau.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
