"use client";

import { ChevronDown, Footprints, Repeat, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MapFrame, RouteMap } from "@/components/map";
import { LegSteps, ModeChip, type StepLabels } from "@/components/route-bits";
import { Chip, cx } from "@/components/ui/primitives";
import { duration, peso } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { Trip } from "@/lib/types";

export function TripResults({ trips, discounted, stepLabels }: { trips: Trip[]; discounted: boolean; stepLabels: StepLabels }) {
  const t = useT();
  const [selected, setSelected] = useState(0);
  const trip = trips[Math.min(selected, trips.length - 1)];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ol className="min-w-0 space-y-3">
        {trips.map((tr, i) => {
          const active = i === selected;
          const rides = tr.legs.filter((l) => l.mode !== "walk");
          const routeIds = new Set(tr.legs.map((l) => l.route_id));
          const confirmations = Math.max(0, ...tr.legs.map((l) => l.still_accurate_count));
          const sample = tr.legs.some((l) => l.is_sample);
          // Walking between stops isn't a "transfer" for commuters; changing vehicles is.
          const transfers = Math.max(0, rides.length - 1);
          return (
            <li key={tr.legs.map((l) => l.leg_id).join("-")}>
              <div
                className={cx(
                  "rounded-2xl bg-white shadow-sm ring-1 transition",
                  active ? "ring-2 ring-brand-500" : "ring-slate-200 hover:ring-brand-200",
                )}
              >
                <button type="button" onClick={() => setSelected(i)} aria-expanded={active} className="w-full p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(rides.length ? rides : tr.legs).map((l, j) => (
                          <ModeChip key={j} mode={l.mode} label={stepLabels.modes[l.mode]} />
                        ))}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {tr.single_route_id ? t("search.directRoute") : t("search.combined", { n: routeIds.size })}
                        {" · "}
                        {transfers ? t("search.transfers", { n: transfers }) : t("search.noTransfer")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold text-slate-900">{peso(discounted ? tr.fare_discounted : tr.fare)}</p>
                      <p className="text-sm text-slate-500">{duration(tr.minutes, t.lang)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    {tr.walk_m > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Footprints className="size-3.5" aria-hidden /> {t("search.walk", { m: tr.walk_m })}
                      </span>
                    ) : null}
                    {transfers ? (
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="size-3.5" aria-hidden /> {transfers}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="size-3.5" aria-hidden /> {confirmations}
                    </span>
                    {sample ? <Chip tone="amber">{t("route.sample")}</Chip> : null}
                    <ChevronDown className={cx("ml-auto size-4 transition", active && "rotate-180")} aria-hidden />
                  </div>
                </button>
                {active ? (
                  <div className="border-t border-slate-100 p-4">
                    <LegSteps
                      lang={t.lang}
                      discounted={discounted}
                      labels={stepLabels}
                      legs={tr.legs.map((l) => ({ ...l, route: tr.single_route_id ? null : { id: l.route_id, title: l.route_title } }))}
                    />
                    <p className="mt-3 text-xs text-slate-500">{t("route.approx")}</p>
                    {tr.single_route_id ? (
                      <Link href={`/routes/${tr.single_route_id}`} prefetch className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
                        {t("search.viewRoute")} →
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="lg:sticky lg:top-20 lg:self-start">
        <MapFrame className="h-72 sm:h-96 lg:h-[520px]">
          {trip ? (
            <RouteMap
              legs={trip.legs.map((l) => ({ mode: l.mode, from: l.from, to: l.to, path: l.path, label: `${stepLabels.modes[l.mode]}${l.signboard ? `: ${l.signboard}` : ""}` }))}
            />
          ) : null}
        </MapFrame>
      </div>
    </div>
  );
}
