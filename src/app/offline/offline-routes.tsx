"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { readOfflineRoutes, type OfflineRoute } from "@/components/pwa";
import { Card, EmptyState } from "@/components/ui/primitives";
import { duration, formatDateTime, peso } from "@/lib/format";
import { en } from "@/lib/i18n/dictionaries";

let cache: { raw: string; value: OfflineRoute[] } = { raw: "", value: [] };
function snapshot(): OfflineRoute[] {
  const map = readOfflineRoutes();
  const raw = JSON.stringify(map);
  if (raw !== cache.raw) cache = { raw, value: Object.values(map).sort((a, b) => a.title.localeCompare(b.title)) };
  return cache.value;
}
const empty: OfflineRoute[] = [];
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export function OfflineRoutesList() {
  const routes = useSyncExternalStore(subscribe, snapshot, () => empty);
  if (!routes.length) {
    return (
      <EmptyState
        title="No routes stored on this device yet"
        body="When you're online, open a route and tap Save. It will be kept here for offline use."
        action={
          <Link href="/" className="font-semibold text-brand-700 underline">
            Find a route
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-4">
      {routes.map((r) => (
        <Card key={r.id}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-semibold text-slate-900">{r.title}</h2>
            <div className="text-right">
              <p className="font-bold">{peso(r.total_fare)}</p>
              <p className="text-xs text-slate-500">{duration(r.total_minutes)}</p>
            </div>
          </div>
          <ol className="mt-3 space-y-2 text-sm">
            {r.legs.map((l, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-2.5">
                <p className="font-medium text-slate-900">
                  {i + 1}. {en.steps[l.mode]} · {l.from.name} → {l.to.name}
                </p>
                {l.signboard ? <p className="font-mono text-xs font-bold uppercase text-slate-700">Signboard: {l.signboard}</p> : null}
                {l.instructions ? <p className="text-slate-600">{l.instructions}</p> : null}
                <p className="text-xs text-slate-500">
                  {peso(l.fare)} · {duration(l.minutes)}
                </p>
              </li>
            ))}
          </ol>
          {r.operating_hours ? <p className="mt-2 text-xs text-slate-500">Hours: {r.operating_hours}</p> : null}
          <p className="mt-1 text-xs text-slate-400">Saved {formatDateTime(r.savedAt)}</p>
        </Card>
      ))}
    </div>
  );
}
