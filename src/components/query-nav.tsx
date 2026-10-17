"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { cx, inputClasses } from "@/components/ui/primitives";

type Updates = Record<string, string | null | undefined>;
type Ctx = { pending: boolean; get: (key: string) => string | null; set: (updates: Updates, opts?: { replace?: boolean }) => void };

const QueryNavContext = createContext<Ctx | null>(null);

/**
 * Wrap a page's filters + results. Tabs, filters and search boxes inside it
 * change the query string client-side (no full reload), highlight instantly
 * (optimistic) and flip the results area to a skeleton while the server
 * renders the new results.
 */
export function QueryNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setOptimisticQuery] = useOptimistic(searchParams.toString());

  const ctx: Ctx = {
    pending,
    get: (key) => new URLSearchParams(query).get(key),
    set: (updates, opts) => {
      const next = new URLSearchParams(query);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!("page" in updates)) next.delete("page");
      const qs = next.toString();
      if (qs === query) return; // re-selecting the current tab does nothing
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        setOptimisticQuery(qs);
        if (opts?.replace) router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
  };
  return <QueryNavContext value={ctx}>{children}</QueryNavContext>;
}

function useQueryNav(): Ctx {
  const ctx = use(QueryNavContext);
  if (!ctx) throw new Error("Wrap this component in <QueryNav>.");
  return ctx;
}

export function FilterTabs({
  param,
  options,
  defaultValue = "",
  label,
}: {
  param: string;
  options: { value: string; label: ReactNode }[];
  defaultValue?: string;
  label: string;
}) {
  const nav = useQueryNav();
  const current = nav.get(param) ?? defaultValue;
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {options.map((o) => {
        const active = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => nav.set({ [param]: o.value === defaultValue ? null : o.value })}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              active ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterSelect({
  param,
  options,
  defaultValue = "",
  label,
}: {
  param: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  label: string;
}) {
  const nav = useQueryNav();
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="shrink-0">{label}</span>
      <select
        className={cx(inputClasses, "w-auto py-1.5")}
        value={nav.get(param) ?? defaultValue}
        onChange={(e) => nav.set({ [param]: e.target.value === defaultValue ? null : e.target.value })}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterToggle({ param, label }: { param: string; label: string }) {
  const nav = useQueryNav();
  const on = nav.get(param) === "1";
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200">
      <input type="checkbox" className="size-4 accent-brand-600" checked={on} onChange={() => nav.set({ [param]: on ? null : "1" })} />
      {label}
    </label>
  );
}

/** Search box that updates ?q= as you type (debounced) without reloading the page. */
export function SearchField({ param = "q", placeholder, label }: { param?: string; placeholder: string; label: string }) {
  const nav = useQueryNav();
  const [value, setValue] = useState(nav.get(param) ?? "");
  const first = useRef(true);
  const setRef = useRef(nav.set);
  useEffect(() => {
    setRef.current = nav.set;
  });

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => setRef.current({ [param]: value.trim() || null }, { replace: true }), 300);
    return () => clearTimeout(id);
  }, [value, param]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={cx(inputClasses, "pl-9 pr-9")}
      />
      {value ? (
        <button type="button" onClick={() => setValue("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600">
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Shows `fallback` (a skeleton) while a filter/tab/search navigation is in flight. */
export function PendingResults({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const nav = useQueryNav();
  return nav.pending ? <div aria-busy="true">{fallback}</div> : <>{children}</>;
}

export function Pagination({ page, hasNext }: { page: number; hasNext: boolean }) {
  const nav = useQueryNav();
  if (page <= 1 && !hasNext) return null;
  return (
    <div className="mt-6 flex items-center justify-between">
      <button
        type="button"
        disabled={page <= 1 || nav.pending}
        onClick={() => nav.set({ page: page - 1 <= 1 ? null : String(page - 1) })}
        className="rounded-xl bg-white px-4 py-2 text-sm font-medium ring-1 ring-slate-200 disabled:opacity-50"
      >
        ← Newer
      </button>
      <span className="text-sm text-slate-500">Page {page}</span>
      <button
        type="button"
        disabled={!hasNext || nav.pending}
        onClick={() => nav.set({ page: String(page + 1) })}
        className="rounded-xl bg-white px-4 py-2 text-sm font-medium ring-1 ring-slate-200 disabled:opacity-50"
      >
        Older →
      </button>
    </div>
  );
}
