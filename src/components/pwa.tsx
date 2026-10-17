"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import type { RouteDetail } from "@/lib/types";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="no-print bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
      <WifiOff className="mr-1 inline size-4 align-text-bottom" aria-hidden />
      You&apos;re offline. Your saved routes are still available under{" "}
      <a href="/offline" className="font-semibold underline">
        Offline routes
      </a>
      .
    </div>
  );
}

// ---------------------------------------------------------------------------
// Offline copies of saved routes (kept in this browser only).
// ---------------------------------------------------------------------------
const KEY = "sakay:offline-routes:v1";

export type OfflineRoute = Pick<
  RouteDetail,
  "id" | "title" | "total_fare" | "total_fare_discounted" | "total_minutes" | "operating_hours" | "accessibility_notes" | "legs"
> & { savedAt: string };

export function readOfflineRoutes(): Record<string, OfflineRoute> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, OfflineRoute>;
  } catch {
    return {};
  }
}

function writeOfflineRoutes(map: Record<string, OfflineRoute>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // storage full or blocked: offline copies are a convenience only
  }
}

function toOffline(r: RouteDetail): OfflineRoute {
  return {
    id: r.id,
    title: r.title,
    total_fare: r.total_fare,
    total_fare_discounted: r.total_fare_discounted,
    total_minutes: r.total_minutes,
    operating_hours: r.operating_hours,
    accessibility_notes: r.accessibility_notes,
    legs: r.legs,
    savedAt: new Date().toISOString(),
  };
}

/** Keeps the offline copy of one route in sync with whether it's saved. */
export function OfflineRouteSync({ route, saved }: { route: RouteDetail; saved: boolean }) {
  const json = JSON.stringify(route);
  useEffect(() => {
    const r = JSON.parse(json) as RouteDetail;
    const map = readOfflineRoutes();
    if (saved) map[r.id] = toOffline(r);
    else delete map[r.id];
    writeOfflineRoutes(map);
  }, [json, saved]);
  return null;
}

/** Replaces the offline store with exactly the routes the user has saved. */
export function OfflineSavedSync({ routes }: { routes: RouteDetail[] }) {
  const json = JSON.stringify(routes);
  useEffect(() => {
    const list = JSON.parse(json) as RouteDetail[];
    writeOfflineRoutes(Object.fromEntries(list.map((r) => [r.id, toOffline(r)])));
  }, [json]);
  return null;
}
