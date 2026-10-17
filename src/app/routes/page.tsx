import { PlusCircle, Route as RouteIcon } from "lucide-react";
import type { Metadata } from "next";
import { LiveRefresh } from "@/components/live-refresh";
import { FilterSelect, FilterTabs, FilterToggle, Pagination, PendingResults, QueryNav, SearchField } from "@/components/query-nav";
import { RouteCard, RouteGridSkeleton } from "@/components/route-bits";
import { Container, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { modeLabels, routeCardLabels } from "@/lib/labels";
import { MODES } from "@/lib/modes";
import { pgrstSafe, ROUTE_SUMMARY } from "@/lib/queries";
import type { RouteSummary, TransportMode } from "@/lib/types";

export const metadata: Metadata = { title: "Browse routes" };

const PAGE_SIZE = 12;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function RoutesPage({ searchParams }: PageProps<"/routes">) {
  const sp = await searchParams;
  const q = pgrstSafe(one(sp.q));
  const mode = MODES.includes(one(sp.mode) as TransportMode) ? (one(sp.mode) as TransportMode) : null;
  const sort = one(sp.sort) || "popular";
  const accessible = one(sp.accessible) === "1";
  const page = Math.max(1, Number.parseInt(one(sp.page) || "1", 10) || 1);

  const [{ t, lang }, { supabase }, labels, modes] = await Promise.all([getI18n(), getViewer(), routeCardLabels(), modeLabels()]);

  let query = supabase.from("routes").select(ROUTE_SUMMARY).eq("status", "published");
  // One combined filter: PostgREST allows a single `or` parameter per request.
  const groups: string[] = [];
  if (q) {
    const like = q.replace(/[_]/g, "\\_");
    groups.push(`or(title.ilike.*${like}*,summary.ilike.*${like}*)`);
  }
  if (accessible) groups.push("or(pwd_friendly.eq.true,senior_friendly.eq.true)");
  if (groups.length) query = query.or(`and(${groups.join(",")})`);
  if (mode) query = query.contains("modes", [mode]);
  if (sort === "newest") query = query.order("created_at", { ascending: false });
  else if (sort === "cheapest") query = query.order("total_fare", { ascending: true });
  else if (sort === "fastest") query = query.order("total_minutes", { ascending: true });
  else query = query.order("still_accurate_count", { ascending: false }).order("save_count", { ascending: false });
  const { data } = await query.order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rows = (data ?? []) as unknown as RouteSummary[];
  const hasNext = rows.length > PAGE_SIZE;
  const routes = rows.slice(0, PAGE_SIZE);

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "routes" }]} />
      <Container>
        <PageHeader
          title={t("nav.routes")}
          subtitle={t("home.contributeCtaBody")}
          actions={
            <LinkButton href="/routes/new" variant="sun">
              <PlusCircle className="size-4" aria-hidden /> {t("nav.contribute")}
            </LinkButton>
          }
        />
        <QueryNav>
          <div className="space-y-3">
            <SearchField placeholder="Search routes, e.g. Cubao, MRT, Fairview" label={t("common.search")} />
            <FilterTabs
              param="mode"
              label="Vehicle type"
              options={[{ value: "", label: t("terminals.filterAll") }, ...MODES.filter((m) => m !== "walk").map((m) => ({ value: m, label: modes[m] }))]}
            />
            <div className="flex flex-wrap items-center gap-3">
              <FilterSelect
                param="sort"
                label={t("common.sort")}
                defaultValue="popular"
                options={[
                  { value: "popular", label: t("common.mostConfirmed") },
                  { value: "newest", label: t("common.newest") },
                  { value: "cheapest", label: t("common.cheapest") },
                  { value: "fastest", label: t("common.fastest") },
                ]}
              />
              <FilterToggle param="accessible" label={t("search.accessibleOnly")} />
            </div>
          </div>
          <div className="mt-5">
            <PendingResults fallback={<RouteGridSkeleton count={6} />}>
              {routes.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {routes.map((r) => (
                    <RouteCard key={r.id} route={r} labels={labels} lang={lang} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<RouteIcon className="size-8" />}
                  title={q || mode || accessible ? "No routes match these filters." : "No routes yet."}
                  body={t("home.contributeCtaBody")}
                  action={
                    <LinkButton href="/routes/new" variant="primary">
                      {t("nav.contribute")}
                    </LinkButton>
                  }
                />
              )}
              <Pagination page={page} hasNext={hasNext} />
            </PendingResults>
          </div>
        </QueryNav>
      </Container>
    </I18nProvider>
  );
}
