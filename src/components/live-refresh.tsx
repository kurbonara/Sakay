"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type LiveTable = { table: string; filter?: string; event?: "INSERT" | "UPDATE" | "DELETE" | "*" };

const MAX_TIMEOUT = 2_147_000_000; // setTimeout limit (~24.8 days)

/**
 * Keeps a server-rendered page live:
 *  - Supabase Realtime: refreshes ~0.5 s after a matching row changes (debounced;
 *    Realtime applies RLS so people only hear about rows they can read).
 *  - Time boundaries: refreshes the moment a start/end time passes, because
 *    nothing changes in the database at that instant.
 *  - Tab visibility: refreshes when you come back to the tab.
 */
export function LiveRefresh({ tables = [], boundaries = [] }: { tables?: LiveTable[]; boundaries?: (string | null | undefined)[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tablesKey = JSON.stringify(tables);
  const boundariesKey = JSON.stringify(boundaries);

  // Debounced refresh shared by every trigger.
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    refreshRef.current = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 450);
    };
    return () => clearTimeout(timer.current);
  }, [router]);

  useEffect(() => {
    const list = JSON.parse(tablesKey) as LiveTable[];
    if (!list.length) return;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return; // env missing: the proxy already shows a setup page
    }
    const channel = supabase.channel(`live:${tablesKey}:${Math.random().toString(36).slice(2)}`);
    for (const t of list) {
      channel.on(
        "postgres_changes",
        { event: t.event ?? "*", schema: "public", table: t.table, ...(t.filter ? { filter: t.filter } : {}) },
        () => refreshRef.current(),
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tablesKey]);

  useEffect(() => {
    const now = Date.now();
    const next = (JSON.parse(boundariesKey) as (string | null)[])
      .filter((b): b is string => Boolean(b))
      .map((b) => new Date(b).getTime())
      .filter((ms) => Number.isFinite(ms) && ms > now)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const id = setTimeout(() => router.refresh(), Math.min(next - now + 300, MAX_TIMEOUT));
    return () => clearTimeout(id);
  }, [boundariesKey, router]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
