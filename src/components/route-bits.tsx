import { Accessibility, Bus, Car, Clock, Footprints, Luggage, Ship, ThumbsDown, ThumbsUp, TrainFront, TriangleAlert, Truck, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Chip, Skeleton, cx } from "@/components/ui/primitives";
import { duration, peso } from "@/lib/format";
import { MODE_STYLE } from "@/lib/modes";
import type { PlaceRef, RouteSummary, TransportMode } from "@/lib/types";

const MODE_ICON: Record<TransportMode, typeof Bus> = {
  jeepney: Truck,
  bus: Bus,
  uv_express: Car,
  tricycle: Users,
  train: TrainFront,
  ferry: Ship,
  walk: Footprints,
};

export function ModeIcon({ mode, className }: { mode: TransportMode; className?: string }) {
  const Icon = MODE_ICON[mode];
  return <Icon className={className ?? "size-4"} aria-hidden />;
}

export function ModeChip({ mode, label }: { mode: TransportMode; label: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", MODE_STYLE[mode].chip)}>
      <ModeIcon mode={mode} className="size-3.5" />
      {label}
    </span>
  );
}

export function AccessibilityChips({ r, labels }: { r: Pick<RouteSummary, "pwd_friendly" | "senior_friendly" | "heavy_load_friendly">; labels: { pwd: string; senior: string; heavy: string } }) {
  if (!r.pwd_friendly && !r.senior_friendly && !r.heavy_load_friendly) return null;
  return (
    <>
      {r.pwd_friendly ? (
        <Chip tone="emerald">
          <Accessibility className="size-3.5" aria-hidden /> {labels.pwd}
        </Chip>
      ) : null}
      {r.senior_friendly ? <Chip tone="emerald">{labels.senior}</Chip> : null}
      {r.heavy_load_friendly ? (
        <Chip tone="emerald">
          <Luggage className="size-3.5" aria-hidden /> {labels.heavy}
        </Chip>
      ) : null}
    </>
  );
}

export type RouteCardLabels = {
  modes: Record<TransportMode, string>;
  sample: string;
  pwd: string;
  senior: string;
  heavy: string;
  reports: string;
  status?: Record<string, string>;
};

export function RouteCard({ route, labels, lang, footer }: { route: RouteSummary; labels: RouteCardLabels; lang: "en" | "fil"; footer?: ReactNode }) {
  const modes = route.modes.filter((m) => m !== "walk");
  return (
    <Card className="print-break flex flex-col gap-3 transition hover:ring-brand-200">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/routes/${route.id}`} prefetch className="min-w-0 font-semibold text-slate-900 hover:text-brand-700">
          <span className="line-clamp-2">{route.title}</span>
        </Link>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-slate-900">{peso(route.total_fare)}</p>
          <p className="text-xs text-slate-500">{duration(route.total_minutes, lang)}</p>
        </div>
      </div>
      <p className="truncate text-sm text-slate-600">
        {route.origin?.name} → {route.destination?.name}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {(modes.length ? modes : route.modes).map((m) => (
          <ModeChip key={m} mode={m} label={labels.modes[m]} />
        ))}
        {route.status !== "published" && labels.status ? <Chip tone={route.status === "rejected" ? "rose" : "amber"}>{labels.status[route.status]}</Chip> : null}
        {route.is_sample ? <Chip tone="amber">{labels.sample}</Chip> : null}
        {route.open_report_count > 0 ? (
          <Chip tone="rose">
            <TriangleAlert className="size-3.5" aria-hidden /> {labels.reports.replace("{n}", String(route.open_report_count))}
          </Chip>
        ) : null}
        <AccessibilityChips r={route} labels={labels} />
      </div>
      <div className="mt-auto flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1" title="Still accurate">
          <ThumbsUp className="size-3.5" aria-hidden /> {route.still_accurate_count}
        </span>
        <span className="inline-flex items-center gap-1" title="Outdated">
          <ThumbsDown className="size-3.5" aria-hidden /> {route.outdated_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden /> {route.leg_count} {route.leg_count === 1 ? "leg" : "legs"}
        </span>
        {footer}
      </div>
    </Card>
  );
}

export function RouteCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-6 w-12" />
      </div>
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-32" />
    </Card>
  );
}

export function RouteGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <RouteCardSkeleton key={i} />
      ))}
    </div>
  );
}

type StepLeg = {
  mode: TransportMode;
  signboard: string | null;
  instructions: string | null;
  fare: number;
  fare_discounted: number | null;
  minutes: number;
  from: PlaceRef;
  to: PlaceRef;
  route?: { id: string; title: string } | null;
  /** imported OpenStreetMap line (shown with attribution) */
  osm?: { id: number; title: string } | null;
  estimated?: boolean;
};

export type StepLabels = {
  modes: Record<TransportMode, string>;
  /** "Sumakay ng jeep" / "Ride a jeep" … */
  actions: Record<TransportMode, string>;
  signboard: string;
  from: string;
  to: string;
  ride: string;
  walk: string;
  getOn: string;
  getOff: string;
  walkFrom: string;
  walkTo: string;
  sayPara: string;
  estimatedFare: string;
  osmLine: string;
};

/** Step-by-step directions. */
export function LegSteps({ legs, labels, discounted, lang }: { legs: StepLeg[]; labels: StepLabels; discounted?: boolean; lang: "en" | "fil" }) {
  return (
    <ol className="relative space-y-0">
      {legs.map((leg, i) => {
        const style = MODE_STYLE[leg.mode];
        const fare = discounted ? (leg.fare_discounted ?? Math.round(leg.fare * 0.8 * 100) / 100) : leg.fare;
        return (
          <li key={i} className="print-break relative flex gap-3 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span className="grid size-8 shrink-0 place-items-center rounded-full text-white shadow-sm" style={{ background: style.hex }}>
                <ModeIcon mode={leg.mode} />
              </span>
              {i < legs.length - 1 ? <span className="mt-1 w-0.5 flex-1 bg-slate-200" aria-hidden /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-semibold text-slate-900">
                  <span className="text-slate-400">{i + 1}.</span> {labels.actions[leg.mode]}
                  <span className="font-normal text-slate-500"> · {duration(leg.minutes, lang)}</span>
                </p>
                <p className="text-sm font-semibold text-slate-800" title={leg.estimated ? labels.estimatedFare : undefined}>
                  {leg.estimated && fare > 0 ? "≈" : ""}
                  {peso(fare, lang)}
                </p>
              </div>
              {leg.signboard ? (
                <p className="mt-1 inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wide text-sun-300">
                  <span className="text-[10px] font-medium normal-case text-slate-400">{labels.signboard}</span>
                  <span className="truncate">{leg.signboard}</span>
                </p>
              ) : null}
              {leg.mode === "walk" ? (
                <p className="mt-1.5 text-sm text-slate-700">
                  <span className="text-slate-500">{labels.walkFrom}</span> {leg.from.name} <span className="text-slate-500">{labels.walkTo}</span> {leg.to.name}
                </p>
              ) : (
                <div className="mt-1.5 space-y-0.5 text-sm text-slate-700">
                  <p>
                    <span className="font-medium text-emerald-700">{labels.getOn}</span> {leg.from.name}
                  </p>
                  <p>
                    <span className="font-medium text-rose-700">{labels.getOff}</span> {leg.to.name}
                  </p>
                </div>
              )}
              {leg.instructions ? <p className="mt-1 text-sm text-slate-600">{leg.instructions}</p> : null}
              {leg.mode === "jeepney" || leg.mode === "tricycle" || leg.mode === "uv_express" ? (
                <p className="mt-1 text-xs text-slate-500">{labels.sayPara}</p>
              ) : null}
              {leg.route ? (
                <Link href={`/routes/${leg.route.id}`} className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">
                  From: {leg.route.title}
                </Link>
              ) : null}
              {leg.osm ? (
                <p className="mt-1 text-xs text-slate-500">
                  {labels.osmLine}:{" "}
                  <a href={`https://www.openstreetmap.org/relation/${leg.osm.id}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                    {leg.osm.title}
                  </a>{" "}
                  · © OpenStreetMap contributors
                </p>
              ) : null}
              {leg.estimated && leg.mode !== "walk" ? <p className="mt-0.5 text-xs text-amber-700">{labels.estimatedFare}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
