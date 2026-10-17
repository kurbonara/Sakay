import { ArrowLeft, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { MapFrame, RouteMap } from "@/components/map";
import { OpenNow } from "@/components/open-now";
import { ReportButton } from "@/components/route-actions";
import { ModeChip, RouteCard } from "@/components/route-bits";
import { TripSearchForm } from "@/components/trip-search-form";
import { Card, Chip, Container, EmptyState } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { modeLabels, routeCardLabels } from "@/lib/labels";
import { PLACE_KIND_LABEL } from "@/lib/modes";
import { PLACE_FULL, ROUTE_SUMMARY } from "@/lib/queries";
import type { Place, RouteSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Place" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlacePage({ params }: PageProps<"/places/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [{ t, lang }, { supabase, userId }, modes, labels] = await Promise.all([getI18n(), getViewer(), modeLabels(), routeCardLabels()]);

  const [placeRes, legsRes] = await Promise.all([
    supabase.from("places").select(PLACE_FULL).eq("id", id).maybeSingle(),
    supabase.from("route_legs").select("route_id").or(`from_place_id.eq.${id},to_place_id.eq.${id}`).limit(200),
  ]);
  const place = placeRes.data as Place | null;
  if (!place) notFound();
  const routeIds = [...new Set((legsRes.data ?? []).map((l) => l.route_id))];
  const { data: routeRows } = routeIds.length
    ? await supabase.from("routes").select(ROUTE_SUMMARY).in("id", routeIds).eq("status", "published").order("still_accurate_count", { ascending: false }).limit(30)
    : { data: [] };
  const routes = (routeRows ?? []) as unknown as RouteSummary[];

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "places", filter: `id=eq.${place.id}` }, { table: "routes" }]} />
      <Container className="space-y-5">
        <Link href="/terminals" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden /> {t("nav.terminals")}
        </Link>
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="blue">{PLACE_KIND_LABEL[place.kind]}</Chip>
                {place.city ? <Chip>{place.city}</Chip> : null}
                {!place.is_verified ? <Chip tone="amber">Not yet verified</Chip> : null}
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{place.name}</h1>
              {place.aliases.length ? <p className="mt-1 text-sm text-slate-500">Also known as: {place.aliases.join(", ")}</p> : null}
              {place.address ? <p className="mt-1 text-sm text-slate-600">{place.address}</p> : null}
            </div>
            <Card className="space-y-2">
              <OpenNow open={place.hours_open} close={place.hours_close} note={place.hours_note} />
              {place.hours_note && place.hours_open ? <p className="text-sm text-slate-600">{place.hours_note}</p> : null}
              {place.description ? <p className="text-sm text-slate-700">{place.description}</p> : null}
              {place.modes.length ? (
                <div className="flex flex-wrap gap-1">
                  {place.modes.map((m) => (
                    <ModeChip key={m} mode={m} label={modes[m]} />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                  <MapPin className="size-4" aria-hidden /> Open in OpenStreetMap
                </a>
                <ReportButton targetType="place" targetId={place.id} signedIn={Boolean(userId)} />
              </div>
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold text-slate-900">Go somewhere from here</h2>
              <TripSearchForm initialFrom={{ text: place.name, place: { id: place.id, name: place.name, lat: place.lat, lng: place.lng } }} />
            </Card>
          </div>
          <MapFrame className="h-72 lg:h-[460px]">
            <RouteMap legs={[]} single={{ id: place.id, name: place.name, lat: place.lat, lng: place.lng }} />
          </MapFrame>
        </div>
        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">{t("terminals.routesHere")}</h2>
          {routes.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {routes.map((r) => (
                <RouteCard key={r.id} route={r} labels={labels} lang={lang} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("terminals.noRoutes")} />
          )}
        </section>
      </Container>
    </I18nProvider>
  );
}
