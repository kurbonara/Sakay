import type { Metadata } from "next";
import Link from "next/link";
import { NotAllowed } from "@/components/admin-bits";
import { LiveRefresh } from "@/components/live-refresh";
import { FilterTabs, PendingResults, QueryNav } from "@/components/query-nav";
import { ModeChip } from "@/components/route-bits";
import { QuestionListSkeleton } from "@/components/skeletons";
import { Card, Chip, Container, EmptyState } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/admin";
import { duration, formatDateTime, peso } from "@/lib/format";
import { modeLabels } from "@/lib/labels";
import { ROUTE_DETAIL } from "@/lib/queries";
import type { RouteDetail, RouteStatus } from "@/lib/types";
import { ModerateForm } from "./moderate-form";

export const metadata: Metadata = { title: "Moderate routes" };

const STATUSES: RouteStatus[] = ["pending", "published", "rejected", "archived"];

export default async function AdminRoutesPage({ searchParams }: PageProps<"/admin/routes">) {
  const viewer = await requireStaff("/admin/routes");
  if (!viewer) return <NotAllowed />;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as RouteStatus) ? (sp.status as RouteStatus) : "pending";
  const [{ data }, modes] = await Promise.all([
    viewer.supabase.from("routes").select(ROUTE_DETAIL).eq("status", status).order("created_at", { ascending: status === "pending" }).limit(50),
    modeLabels(),
  ]);
  const routes = (data ?? []) as unknown as RouteDetail[];

  return (
    <Container className="space-y-4">
      <LiveRefresh tables={[{ table: "routes" }]} />
      <h1 className="text-2xl font-bold text-slate-900">Routes</h1>
      <QueryNav>
        <FilterTabs param="status" defaultValue="pending" label="Route status" options={STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
        <div className="mt-4">
          <PendingResults fallback={<QuestionListSkeleton rows={4} />}>
            {routes.length ? (
              <ul className="space-y-3">
                {routes.map((r) => (
                  <li key={r.id}>
                    <Card className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/routes/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                            {r.title}
                          </Link>
                          {r.is_sample ? <Chip tone="amber">Sample</Chip> : null}
                          {r.open_report_count ? <Chip tone="rose">{r.open_report_count} reports</Chip> : null}
                        </div>
                        <p className="text-sm text-slate-600">
                          {r.origin.name} → {r.destination.name} · {peso(r.total_fare)} · {duration(r.total_minutes)}
                        </p>
                        <ol className="space-y-1 text-sm text-slate-700">
                          {[...r.legs]
                            .sort((a, b) => a.seq - b.seq)
                            .map((l) => (
                              <li key={l.id} className="flex flex-wrap items-center gap-1.5">
                                <ModeChip mode={l.mode} label={modes[l.mode]} />
                                <span>
                                  {l.from.name} → {l.to.name}
                                </span>
                                {l.signboard ? <span className="font-mono text-xs uppercase text-slate-500">[{l.signboard}]</span> : null}
                                <span className="text-xs text-slate-500">
                                  {peso(l.fare)} · {l.minutes}m
                                </span>
                              </li>
                            ))}
                        </ol>
                        <p className="text-xs text-slate-500">
                          By {r.submitter ? <Link href={`/u/${r.submitter.username}`} className="underline">{r.submitter.display_name}</Link> : "sample data / former member"} ·{" "}
                          {formatDateTime(r.created_at)}
                          {r.reviewed_at ? ` · reviewed ${formatDateTime(r.reviewed_at)}` : ""}
                        </p>
                        {r.review_note ? <p className="text-sm text-slate-600">Note: {r.review_note}</p> : null}
                      </div>
                      <div className="space-y-2">
                        <ModerateForm routeId={r.id} status={r.status} />
                        <Link href={`/admin/routes/${r.id}/edit`} className="inline-block text-sm font-medium text-brand-700 hover:underline">
                          Edit route data →
                        </Link>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={`No ${status} routes.`} body={status === "pending" ? "You're all caught up." : undefined} />
            )}
          </PendingResults>
        </div>
      </QueryNav>
    </Container>
  );
}
