import type { SupabaseClient } from "@supabase/supabase-js";
import { MapPinOff, MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { LiveRefresh } from "@/components/live-refresh";
import { FilterTabs, FilterToggle, PendingResults, QueryNav } from "@/components/query-nav";
import { ShareButtons } from "@/components/share-buttons";
import { TripSearchForm } from "@/components/trip-search-form";
import { Card, Chip, Container, EmptyState, LinkButton, Skeleton } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { geocode, isInPhilippines } from "@/lib/geocode";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { stepLabels as getStepLabels } from "@/lib/labels";
import type { PlaceRef, Trip } from "@/lib/types";
import { TripResults } from "./trip-results";

export const metadata: Metadata = { title: "Route search" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

type Resolved = { place: PlaceRef | null; alternatives: PlaceRef[]; fromMap: boolean };

/**
 * Turn what the user picked/typed into a point:
 * 1. a Sakay place id, 2. coordinates of a map place they picked,
 * 3. the best Sakay match for the text, 4. the best OpenStreetMap match.
 */
async function resolvePlace(supabase: SupabaseClient, id: string, text: string, lat: number, lng: number): Promise<Resolved> {
  if (UUID.test(id)) {
    const { data } = await supabase.from("places").select("id, name, lat, lng, kind, city").eq("id", id).maybeSingle();
    if (data) return { place: data as PlaceRef, alternatives: [], fromMap: false };
  }
  if (Number.isFinite(lat) && Number.isFinite(lng) && isInPhilippines(lat, lng)) {
    return { place: { id: "", name: text || "Selected place", lat, lng }, alternatives: [], fromMap: true };
  }
  if (text.length < 2) return { place: null, alternatives: [], fromMap: false };
  const { data } = await supabase.rpc("search_places", { p_query: text, p_limit: 5 });
  const list = (data ?? []) as (PlaceRef & { score: number })[];
  // A strong Sakay match (the name contains what was typed) wins outright.
  // A weak one ("Puregold Malolos" vs "Malolos Crossing") loses to an exact map match.
  if (list.length && list[0].score >= 0.6) return { place: list[0], alternatives: list.slice(1), fromMap: false };
  const map = await geocode(text, { limit: 4, signal: AbortSignal.timeout(4000), userAgent: `Sakay (${siteUrl()})` });
  if (!map.length) return list.length ? { place: list[0], alternatives: list.slice(1), fromMap: false } : { place: null, alternatives: [], fromMap: false };
  const [first, ...rest] = map.map((m) => ({ id: "", name: m.city && !m.name.includes(m.city) ? `${m.name}, ${m.city}` : m.name, lat: m.lat, lng: m.lng }));
  return { place: first, alternatives: [...list.slice(0, 2), ...rest].slice(0, 4), fromMap: true };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const fromText = one(sp.from);
  const toText = one(sp.to);
  const discounted = one(sp.fare) === "discount";
  const accessibleOnly = one(sp.accessible) === "1";
  const [{ t, lang }, viewer, stepLabels] = await Promise.all([getI18n(), getViewer(), getStepLabels()]);
  const { supabase } = viewer;

  if (!fromText || !toText) {
    return (
      <I18nProvider lang={lang}>
        <Container className="max-w-2xl">
          <h1 className="mb-4 text-2xl font-bold">{t("home.title")}</h1>
          <Card>
            <TripSearchForm />
          </Card>
        </Container>
      </I18nProvider>
    );
  }

  const [origin, destination] = await Promise.all([
    resolvePlace(supabase, one(sp.fromId), fromText, Number(one(sp.fromLat) || NaN), Number(one(sp.fromLng) || NaN)),
    resolvePlace(supabase, one(sp.toId), toText, Number(one(sp.toLat) || NaN), Number(one(sp.toLng) || NaN)),
  ]);

  let trips: Trip[] = [];
  let widened = false;
  const samePlace = origin.place && destination.place && origin.place.lat === destination.place.lat && origin.place.lng === destination.place.lng;
  if (origin.place && destination.place && !samePlace) {
    const o = origin.place;
    const d = destination.place;
    const find = (radius: number) =>
      supabase.rpc("find_trips_at", { p_from_lat: o.lat, p_from_lng: o.lng, p_to_lat: d.lat, p_to_lng: d.lng, p_max_legs: 4, p_limit: 8, p_radius: radius });
    trips = ((await find(500)).data ?? []) as Trip[];
    // Town names ("Malolos", "Hagonoy") often point at a landmark that isn't the
    // terminal itself; look for stops up to 2 km away before giving up.
    if (!trips.length) {
      trips = ((await find(2000)).data ?? []) as Trip[];
      widened = trips.length > 0;
    }
  }

  // Accessibility filter: every route used by the trip must be marked friendly.
  let shown = trips;
  if (accessibleOnly && trips.length) {
    const ids = [...new Set(trips.flatMap((tr) => tr.legs.map((l) => l.route_id)))];
    const { data } = await supabase.from("routes").select("id, pwd_friendly, senior_friendly").in("id", ids);
    const ok = new Set((data ?? []).filter((r) => r.pwd_friendly || r.senior_friendly).map((r) => r.id));
    shown = trips.filter((tr) => tr.legs.every((l) => ok.has(l.route_id)));
  }

  // Related questions for this trip (also the duplicate-question check).
  const { data: similar } = await supabase.rpc("similar_questions", {
    p_title: `${fromText} to ${toText}`,
    p_origin: origin.place?.id || null,
    p_destination: destination.place?.id || null,
    p_limit: 4,
  });
  const related = (similar ?? []) as { id: string; title: string; answer_count: number; has_best_answer: boolean }[];

  // Record the search after the response is sent (powers analytics + recent searches).
  after(async () => {
    await supabase.rpc("log_search", {
      p_origin_text: fromText,
      p_destination_text: toText,
      p_origin: origin.place?.id || null,
      p_destination: destination.place?.id || null,
      p_result_count: trips.length,
    });
  });

  const fromName = origin.place?.name ?? fromText;
  const toName = destination.place?.name ?? toText;
  const shareParams = new URLSearchParams({ from: fromName, to: toName });
  for (const [side, r] of [["from", origin], ["to", destination]] as const) {
    if (r.place?.id) shareParams.set(`${side}Id`, r.place.id);
    else if (r.place) {
      shareParams.set(`${side}Lat`, String(r.place.lat));
      shareParams.set(`${side}Lng`, String(r.place.lng));
    }
  }
  const askParams = new URLSearchParams(shareParams);
  for (const k of ["fromLat", "fromLng", "toLat", "toLng"]) askParams.delete(k);

  const altLink = (which: "from" | "to", p: PlaceRef) => {
    const q = new URLSearchParams(shareParams);
    q.set(which, p.name);
    for (const k of ["Id", "Lat", "Lng"]) q.delete(`${which}${k}`);
    if (p.id) q.set(`${which}Id`, p.id);
    else {
      q.set(`${which}Lat`, String(p.lat));
      q.set(`${which}Lng`, String(p.lng));
    }
    return `/search?${q.toString()}`;
  };

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "routes" }, { table: "route_legs" }]} />
      <Container className="space-y-5">
        <Card className="no-print">
          <TripSearchForm
            compact
            key={`${fromText}|${toText}`}
            initialFrom={{ text: fromName, place: origin.place ? { ...origin.place, source: origin.fromMap ? "map" : "sakay" } : null }}
            initialTo={{ text: toName, place: destination.place ? { ...destination.place, source: destination.fromMap ? "map" : "sakay" } : null }}
          />
        </Card>

        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{t("search.resultsFor", { from: fromName, to: toName })}</h1>
          {[
            ["from", origin] as const,
            ["to", destination] as const,
          ].map(([which, r]) =>
            r.alternatives.length ? (
              <p key={which} className="mt-1 text-sm text-slate-600">
                {t("search.didYouMean")}{" "}
                {r.alternatives.slice(0, 3).map((p, i) => (
                  <span key={p.id}>
                    {i ? ", " : ""}
                    <Link className="font-medium text-brand-700 hover:underline" href={altLink(which, p)}>
                      {p.name}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null,
          )}
        </div>

        {!origin.place || !destination.place ? (
          <EmptyState
            icon={<MapPinOff className="size-8" />}
            title={t("search.pickPlace", { q: !origin.place ? fromText : toText })}
            body={t("search.noResultsBody")}
            action={
              <LinkButton href={`/questions/ask?${askParams.toString()}`} variant="primary">
                <MessageCircleQuestion className="size-4" /> {t("search.askThis")}
              </LinkButton>
            }
          />
        ) : (
          <QueryNav>
            <div className="no-print flex flex-wrap items-center gap-2">
              <FilterTabs
                param="fare"
                label={t("search.fareType")}
                options={[
                  { value: "", label: t("search.fareRegular") },
                  { value: "discount", label: t("search.fareDiscounted") },
                ]}
              />
              <FilterToggle param="accessible" label={t("search.accessibleOnly")} />
            </div>
            {origin.fromMap || destination.fromMap ? (
              <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800 ring-1 ring-brand-200">{t("search.fromMap")}</p>
            ) : null}
            {widened ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{t("search.widened")}</p>
            ) : null}
            <PendingResults
              fallback={
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                    ))}
                  </div>
                  <Skeleton className="h-72 w-full rounded-2xl lg:h-[520px]" />
                </div>
              }
            >
              {shown.length ? (
                <TripResults trips={shown} discounted={discounted} stepLabels={stepLabels} />
              ) : (
                <EmptyState
                  icon={<MapPinOff className="size-8" />}
                  title={t("search.noResults")}
                  body={t("search.noResultsBody")}
                  action={
                    <LinkButton href={`/questions/ask?${askParams.toString()}`} variant="primary">
                      <MessageCircleQuestion className="size-4" /> {t("search.askThis")}
                    </LinkButton>
                  }
                />
              )}
            </PendingResults>
          </QueryNav>
        )}

        {related.length ? (
          <Card>
            <h2 className="font-semibold text-slate-900">{t("qa.similarTitle")}</h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {related.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/questions/${q.id}`} className="min-w-0 truncate text-sm font-medium text-brand-700 hover:underline">
                    {q.title}
                  </Link>
                  <span className="flex shrink-0 gap-1">
                    {q.has_best_answer ? <Chip tone="emerald">{t("qa.best")}</Chip> : null}
                    <Chip>{t("qa.answers", { n: q.answer_count })}</Chip>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className="no-print">
          <h2 className="mb-3 font-semibold text-slate-900">{t("search.share")}</h2>
          <ShareButtons url={`${siteUrl()}/search?${shareParams.toString()}`} title={t("search.resultsFor", { from: fromName, to: toName })} />
        </Card>
      </Container>
    </I18nProvider>
  );
}
