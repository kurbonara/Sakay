import { Bookmark, WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { LiveRefresh } from "@/components/live-refresh";
import { OfflineSavedSync } from "@/components/pwa";
import { RouteCard } from "@/components/route-bits";
import { Chip, Container, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { routeCardLabels } from "@/lib/labels";
import { ROUTE_DETAIL } from "@/lib/queries";
import type { RouteDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Saved routes" };

export default async function SavedPage() {
  const [{ t, lang }, { supabase, userId }, labels] = await Promise.all([getI18n(), requireViewer("/saved"), routeCardLabels()]);
  const { data } = await supabase.from("route_saves").select(`created_at, route:routes(${ROUTE_DETAIL})`).eq("user_id", userId!).order("created_at", { ascending: false });
  const routes = ((data ?? []) as unknown as { route: RouteDetail | null }[])
    .map((s) => s.route)
    .filter((r): r is RouteDetail => Boolean(r))
    .map((r) => ({ ...r, legs: [...r.legs].sort((a, b) => a.seq - b.seq) }));

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "route_saves", filter: `user_id=eq.${userId}` }, { table: "routes" }]} />
      <OfflineSavedSync routes={routes} />
      <Container>
        <PageHeader
          title={t("saved.title")}
          subtitle={t("saved.subtitle")}
          actions={
            <LinkButton href="/offline" variant="secondary">
              <WifiOff className="size-4" aria-hidden /> Offline view
            </LinkButton>
          }
        />
        {routes.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((r) => (
              <RouteCard key={r.id} route={r} labels={labels} lang={lang} footer={<Chip tone="emerald">{t("saved.offlineReady")}</Chip>} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Bookmark className="size-8" />}
            title={t("saved.empty")}
            action={
              <LinkButton href="/routes" variant="primary">
                {t("nav.routes")}
              </LinkButton>
            }
          />
        )}
      </Container>
    </I18nProvider>
  );
}
