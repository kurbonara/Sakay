import { requestNow } from "@/lib/time";
import { Accessibility, ArrowLeft, Clock, Pencil, ShieldCheck, TriangleAlert, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentForm } from "@/components/comments";
import { LiveRefresh } from "@/components/live-refresh";
import { MapFrame, RouteMap } from "@/components/map";
import { OwnContentControls } from "@/components/own-content";
import { OfflineRouteSync } from "@/components/pwa";
import { AccessibilityChips, LegSteps, ModeChip } from "@/components/route-bits";
import { Card, Chip, Container, Skeleton } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { duration, formatDateTime, peso, timeAgo } from "@/lib/format";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { stepLabels as getStepLabels } from "@/lib/labels";
import { getPublicRouteMeta } from "@/lib/public-data";
import { COMMENT, ROUTE_DETAIL } from "@/lib/queries";
import type { RouteComment, RouteDetail } from "@/lib/types";
import { ConfirmBox, PrintButton, ReportButton, SaveButton, ShareModal } from "@/components/route-actions";

export async function generateMetadata({ params }: PageProps<"/routes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meta = await getPublicRouteMeta(id);
  if (!meta) return { title: "Route" };
  const description = `${meta.origin?.name} → ${meta.destination?.name}: about ${peso(meta.total_fare)}, ${duration(meta.total_minutes)}. Step-by-step directions with signboards on Sakay.`;
  return { title: meta.title, description, openGraph: { title: meta.title, description } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RoutePage({ params }: PageProps<"/routes/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [{ t, lang }, viewer, stepLabels] = await Promise.all([getI18n(), getViewer(), getStepLabels()]);
  const { supabase, userId, isStaff } = viewer;

  const [routeRes, savedRes, confirmRes] = await Promise.all([
    supabase.from("routes").select(ROUTE_DETAIL).eq("id", id).maybeSingle(),
    userId ? supabase.from("route_saves").select("route_id").eq("route_id", id).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
    userId ? supabase.from("route_confirmations").select("is_accurate").eq("route_id", id).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const route = routeRes.data as unknown as RouteDetail | null;
  if (!route) notFound();
  route.legs.sort((a, b) => a.seq - b.seq);
  const saved = Boolean(savedRes.data);
  const mine = (confirmRes.data as { is_accurate: boolean } | null)?.is_accurate ?? null;
  const published = route.status === "published";
  const url = `${siteUrl()}/routes/${route.id}`;
  const now = await requestNow();
  const rides = route.modes.filter((m) => m !== "walk");

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh
        tables={[
          { table: "routes", filter: `id=eq.${route.id}` },
          { table: "route_legs", filter: `route_id=eq.${route.id}` },
          { table: "route_comments", filter: `route_id=eq.${route.id}` },
        ]}
      />
      <OfflineRouteSync route={route} saved={saved} />
      <Container className="space-y-5">
        <Link href="/routes" className="no-print inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden /> {t("nav.routes")}
        </Link>

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(rides.length ? rides : route.modes).map((m) => (
              <ModeChip key={m} mode={m} label={stepLabels.modes[m]} />
            ))}
            {route.is_sample ? <Chip tone="amber">{t("route.sample")}</Chip> : null}
            {route.status === "pending" ? <Chip tone="amber">{t("route.pending")}</Chip> : null}
            {route.status === "rejected" ? <Chip tone="rose">{t("route.rejected")}</Chip> : null}
            {route.status === "archived" ? <Chip>{t("route.archived")}</Chip> : null}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{route.title}</h1>
          <p className="text-slate-600">
            {route.origin.name} → {route.destination.name}
          </p>
          {route.summary ? <p className="max-w-3xl text-sm text-slate-700">{route.summary}</p> : null}
        </header>

        {route.status === "rejected" && route.review_note ? (
          <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
            <strong>Moderator note:</strong> {route.review_note}
          </p>
        ) : null}
        {route.is_sample ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{t("route.sampleNote")}</p> : null}
        {route.open_report_count > 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> {t("route.openReports", { n: route.open_report_count })}
          </p>
        ) : null}

        <div className="no-print flex flex-wrap gap-2">
          <SaveButton routeId={route.id} saved={saved} signedIn={Boolean(userId)} />
          <ShareModal url={url} title={route.title} imageUrl={published ? `/routes/${route.id}/opengraph-image` : undefined} />
          <PrintButton />
          {published ? <ReportButton targetType="route" targetId={route.id} signedIn={Boolean(userId)} /> : null}
          {isStaff ? (
            <Link href={`/admin/routes/${route.id}/edit`} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50">
              <Pencil className="size-4" aria-hidden /> Edit (staff)
            </Link>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-3 p-4">
            <Wallet className="size-6 text-brand-600" aria-hidden />
            <div>
              <p className="text-xs text-slate-500">{t("route.totalFare")}</p>
              <p className="text-lg font-bold">
                {peso(route.total_fare)} <span className="text-sm font-medium text-slate-500">/ {peso(route.total_fare_discounted)} {t("search.fareDiscounted")}</span>
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <Clock className="size-6 text-brand-600" aria-hidden />
            <div>
              <p className="text-xs text-slate-500">{t("route.totalTime")}</p>
              <p className="text-lg font-bold">
                {duration(route.total_minutes, lang)} <span className="text-sm font-medium text-slate-500">· {route.leg_count} {t("route.legs")}</span>
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <ShieldCheck className="size-6 text-emerald-600" aria-hidden />
            <div>
              <p className="text-xs text-slate-500">{t("route.hours")}</p>
              <p className="font-semibold">{route.operating_hours ?? "—"}</p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card>
              <h2 className="mb-4 text-lg font-bold text-slate-900">{t("route.steps")}</h2>
              <LegSteps legs={route.legs} labels={stepLabels} lang={lang} />
              <p className="mt-4 text-xs text-slate-500">{t("route.approx")}</p>
            </Card>

            {route.pwd_friendly || route.senior_friendly || route.heavy_load_friendly || route.accessibility_notes ? (
              <Card>
                <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-900">
                  <Accessibility className="size-5 text-emerald-600" aria-hidden /> {t("route.accessibility")}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <AccessibilityChips r={route} labels={{ pwd: t("route.pwd"), senior: t("route.senior"), heavy: t("route.heavy") }} />
                </div>
                {route.accessibility_notes ? <p className="mt-2 text-sm text-slate-700">{route.accessibility_notes}</p> : null}
              </Card>
            ) : null}

            <div className="no-print">
              <ConfirmBox
                routeId={route.id}
                accurate={route.still_accurate_count}
                outdated={route.outdated_count}
                mine={mine}
                signedIn={Boolean(userId)}
                published={published}
              />
              {route.last_confirmed_at ? (
                <p className="mt-2 text-xs text-slate-500">{t("route.lastConfirmed", { when: timeAgo(route.last_confirmed_at, now, lang) })}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            <MapFrame className="h-72 sm:h-96 lg:h-[440px]">
              <RouteMap legs={route.legs.map((l) => ({ mode: l.mode, from: l.from, to: l.to, path: l.path, label: `${stepLabels.modes[l.mode]}${l.signboard ? `: ${l.signboard}` : ""}` }))} />
            </MapFrame>
            <p className="text-xs text-slate-500">
              {route.submitter ? (
                <>
                  {t("route.submittedBy")}{" "}
                  <Link href={`/u/${route.submitter.username}`} className="font-medium text-brand-700 hover:underline">
                    {route.submitter.display_name}
                  </Link>{" "}
                  ·{" "}
                </>
              ) : null}
              {formatDateTime(route.published_at ?? route.created_at)}
            </p>
          </div>
        </div>

        {published ? (
          <section className="no-print">
            <h2 className="mb-3 text-lg font-bold text-slate-900">
              {t("route.tips")} <span className="text-sm font-medium text-slate-500">({route.comment_count})</span>
            </h2>
            <Card className="space-y-4">
              <CommentForm routeId={route.id} signedIn={Boolean(userId)} />
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <Comments routeId={route.id} />
              </Suspense>
            </Card>
          </section>
        ) : null}
      </Container>
    </I18nProvider>
  );
}

async function Comments({ routeId }: { routeId: string }) {
  const [{ supabase, userId, isStaff }, { t, lang }] = await Promise.all([getViewer(), getI18n()]);
  const { data } = await supabase.from("route_comments").select(COMMENT).eq("route_id", routeId).order("created_at", { ascending: false }).limit(50);
  const comments = ((data ?? []) as unknown as RouteComment[]).filter((c) => !c.is_removed || isStaff);
  const now = await requestNow();
  const windowMs = 30 * 60 * 1000;
  if (!comments.length) return <p className="text-sm text-slate-500">{t("route.noTips")}</p>;
  return (
    <>
      <LiveRefresh boundaries={comments.filter((c) => c.author_id === userId).map((c) => new Date(new Date(c.created_at).getTime() + windowMs).toISOString())} />
      <ul className="divide-y divide-slate-100">
        {comments.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Chip tone={c.kind === "tip" ? "amber" : "slate"}>{c.kind === "tip" ? "Tip" : "Comment"}</Chip>
              {c.author ? (
                <Link href={`/u/${c.author.username}`} className="font-medium text-slate-700 hover:underline">
                  {c.author.display_name}
                </Link>
              ) : (
                <span>{t("common.deletedUser")}</span>
              )}
              <span>· {timeAgo(c.created_at, now, lang)}</span>
              {c.is_removed ? <Chip tone="rose">Removed</Chip> : null}
              {c.author_id !== userId ? (
                <span className="ml-auto">
                  <ReportButton targetType="comment" targetId={c.id} signedIn={Boolean(userId)} compact />
                </span>
              ) : null}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{c.body}</p>
            {c.author_id === userId && !c.is_removed ? (
              <OwnContentControls type="comment" id={c.id} body={c.body} canEdit={now - new Date(c.created_at).getTime() < windowMs} />
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
