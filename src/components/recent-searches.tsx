"use client";

import { History } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

export type RecentSearch = { from: string; to: string; fromId?: string | null; toId?: string | null };

const KEY = "sakay:recent-searches:v1";

/** Remember a search on this device (works for signed-out visitors too). */
export function rememberSearch(s: RecentSearch) {
  try {
    const list = (JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentSearch[]).filter(
      (x) => !(x.from.toLowerCase() === s.from.toLowerCase() && x.to.toLowerCase() === s.to.toLowerCase()),
    );
    localStorage.setItem(KEY, JSON.stringify([s, ...list].slice(0, 8)));
    window.dispatchEvent(new Event("sakay-recent"));
  } catch {
    // private mode or storage blocked
  }
}

let cached: { raw: string | null; list: RecentSearch[] } = { raw: null, list: [] };
function read(): RecentSearch[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cached.raw) {
    try {
      cached = { raw, list: JSON.parse(raw ?? "[]") as RecentSearch[] };
    } catch {
      cached = { raw, list: [] };
    }
  }
  return cached.list;
}
const none: RecentSearch[] = [];
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("sakay-recent", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("sakay-recent", cb);
  };
}

export function searchHref(s: RecentSearch) {
  const p = new URLSearchParams({ from: s.from, to: s.to });
  if (s.fromId) p.set("fromId", s.fromId);
  if (s.toId) p.set("toId", s.toId);
  return `/search?${p.toString()}`;
}

/** Recent searches: the signed-in user's history from the database, merged with this device's. */
export function RecentSearches({ server, emptyText }: { server: RecentSearch[]; emptyText: string }) {
  const local = useSyncExternalStore(subscribe, read, () => none);
  const seen = new Set<string>();
  const merged = [...local, ...server].filter((s) => {
    const k = `${s.from.toLowerCase()}|${s.to.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!merged.length) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {merged.slice(0, 8).map((s) => (
        <li key={`${s.from}|${s.to}`}>
          <Link
            href={searchHref(s)}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <History className="size-3.5 shrink-0 text-slate-400" aria-hidden />
            <span className="truncate">
              {s.from} → {s.to}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
