import { MapPin, TrainFront, Warehouse } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { OpenNow } from "@/components/open-now";
import { FilterSelect, FilterTabs, PendingResults, QueryNav, SearchField } from "@/components/query-nav";
import { ModeChip } from "@/components/route-bits";
import { Card, Container, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { modeLabels } from "@/lib/labels";
import { MODES } from "@/lib/modes";
import { PLACE_FULL, pgrstSafe } from "@/lib/queries";
import type { Place, TransportMode } from "@/lib/types";

export const metadata: Metadata = { title: "Terminals & stations" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function TerminalsPage({ searchParams }: PageProps<"/terminals">) {
  const sp = await searchParams;
  const q = pgrstSafe(one(sp.q)).toLowerCase();
  const kind = one(sp.kind) === "station" ? "station" : one(sp.kind) === "terminal" ? "terminal" : null;
  const mode = MODES.includes(one(sp.mode) as TransportMode) ? (one(sp.mode) as TransportMode) : null;
  const [{ t, lang }, { supabase }, modes] = await Promise.all([getI18n(), getViewer(), modeLabels()]);

  let query = supabase.from("places").select(PLACE_FULL).eq("is_verified", true);
  query = kind ? query.eq("kind", kind) : query.in("kind", ["terminal", "station"]);
  if (mode) query = query.contains("modes", [mode]);
  if (q) query = query.ilike("search_text", `%${q.replace(/_/g, "\\_")}%`);
  const { data } = await query.order("city").order("name").limit(200);
  const places = (data ?? []) as Place[];

  const byCity = new Map<string, Place[]>();
  for (const p of places) byCity.set(p.city ?? "Other", [...(byCity.get(p.city ?? "Other") ?? []), p]);

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "places" }]} />
      <Container>
        <PageHeader title={t("terminals.title")} subtitle={t("terminals.subtitle")} />
        <QueryNav>
          <div className="space-y-3">
            <SearchField placeholder="Search terminals or stations, e.g. PITX, Cubao" label={t("common.search")} />
            <div className="flex flex-wrap items-center gap-3">
              <FilterTabs
                param="kind"
                label="Type"
                options={[
                  { value: "", label: t("terminals.filterAll") },
                  { value: "terminal", label: "Terminals" },
                  { value: "station", label: "Train stations" },
                ]}
              />
              <FilterSelect
                param="mode"
                label="Vehicle"
                options={[{ value: "", label: t("terminals.filterAll") }, ...MODES.filter((m) => m !== "walk").map((m) => ({ value: m, label: modes[m] }))]}
              />
            </div>
          </div>
          <div className="mt-5">
            <PendingResults
              fallback={
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                  ))}
                </div>
              }
            >
              {places.length ? (
                <div className="space-y-6">
                  {[...byCity].map(([city, list]) => (
                    <section key={city}>
                      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{city}</h2>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {list.map((p) => (
                          <Card key={p.id} className="print-break flex flex-col gap-2">
                            <Link href={`/places/${p.id}`} prefetch className="flex items-start gap-2 font-semibold text-slate-900 hover:text-brand-700">
                              {p.kind === "station" ? <TrainFront className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden /> : <Warehouse className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />}
                              {p.name}
                            </Link>
                            <OpenNow open={p.hours_open} close={p.hours_close} note={p.hours_note} />
                            {p.hours_note && p.hours_open ? <p className="text-xs text-slate-500">{p.hours_note}</p> : null}
                            {p.modes.length ? (
                              <div className="flex flex-wrap gap-1">
                                {p.modes.map((m) => (
                                  <ModeChip key={m} mode={m} label={modes[m]} />
                                ))}
                              </div>
                            ) : null}
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700"
                            >
                              <MapPin className="size-3.5" aria-hidden /> Open in map
                            </a>
                          </Card>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <EmptyState title={t("terminals.empty")} />
              )}
            </PendingResults>
          </div>
        </QueryNav>
      </Container>
    </I18nProvider>
  );
}
