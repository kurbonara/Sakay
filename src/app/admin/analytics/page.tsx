import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NotAllowed, StatCard } from "@/components/admin-bits";
import { LiveRefresh } from "@/components/live-refresh";
import { FilterTabs, PendingResults, QueryNav } from "@/components/query-nav";
import { PrintButton } from "@/components/route-actions";
import { Card, Container, Skeleton, buttonClasses } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Analytics" };

type Pair = { origin: string; destination: string; searches: number; avg_results?: number; last_searched: string };
type Area = { area: string; questions: number; unanswered: number };
type Analytics = {
  days: number;
  top_searches: Pair[];
  missing_routes: Pair[];
  asked_areas: Area[];
  unanswered: { id: string; title: string; created_at: string }[];
  totals: Record<string, number>;
  searches_by_day: { day: string; searches: number; zero_results: number }[];
};

/** Single-series magnitude bar (one hue; the number is always printed beside it). */
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-100" aria-hidden>
      <div className="h-2 rounded-r-full bg-brand-500" style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%`, borderRadius: 4 }} />
    </div>
  );
}

function ExportLink({ kind, days }: { kind: string; days: number }) {
  return (
    <a href={`/admin/export/${kind}?days=${days}`} className={buttonClasses("ghost", "sm", "no-print")}>
      <Download className="size-4" aria-hidden /> CSV
    </a>
  );
}

function PairTable({ rows, title, hint, kind, days }: { rows: Pair[]; title: string; hint: string; kind: string; days: number }) {
  const max = Math.max(0, ...rows.map((r) => r.searches));
  return (
    <Card className="print-break">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900">{title}</h2>
        <ExportLink kind={kind} days={days} />
      </div>
      <p className="mb-3 text-xs text-slate-500">{hint}</p>
      {rows.length ? (
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Trip</th>
              <th>Searches</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.origin}|${r.destination}`} className="align-middle" title={`Last searched ${formatDateTime(r.last_searched)}`}>
                <td className="py-1.5 pr-3">
                  <Link href={`/search?from=${encodeURIComponent(r.origin)}&to=${encodeURIComponent(r.destination)}`} className="text-slate-800 hover:text-brand-700">
                    {r.origin} → {r.destination}
                  </Link>
                  <Bar value={r.searches} max={max} />
                </td>
                <td className="w-14 py-1.5 text-right font-semibold tabular-nums text-slate-700">{r.searches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-slate-500">No data in this period yet.</p>
      )}
    </Card>
  );
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const viewer = await requireStaff("/admin/analytics");
  if (!viewer) return <NotAllowed />;
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const { data, error } = await viewer.supabase.rpc("admin_analytics", { p_days: days });
  const a = (data ?? null) as Analytics | null;
  const daily = a?.searches_by_day ?? [];
  const dayMax = Math.max(0, ...daily.map((d) => d.searches));
  const areaMax = Math.max(0, ...(a?.asked_areas ?? []).map((x) => x.questions));

  return (
    <Container className="space-y-5">
      <LiveRefresh tables={[{ table: "questions" }, { table: "routes" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <PrintButton />
      </div>
      <QueryNav>
        <div className="no-print">
          <FilterTabs
            param="days"
            defaultValue="30"
            label="Time range"
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "90", label: "Last 90 days" },
            ]}
          />
        </div>
        <PendingResults
          fallback={
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          }
        >
          {error || !a ? (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Couldn&apos;t load analytics. {error?.message}</p>
          ) : (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <StatCard label="Searches" value={a.totals.searches ?? 0} />
                <StatCard label="Searches with no route" value={a.totals.zero_result_searches ?? 0} tone="amber" />
                <StatCard label="Questions asked" value={a.totals.questions ?? 0} tone="blue" />
                <StatCard label="Answers posted" value={a.totals.answers ?? 0} />
                <StatCard label="Routes submitted" value={a.totals.routes_submitted ?? 0} />
                <StatCard label="Routes published" value={a.totals.routes_published ?? 0} tone="emerald" />
              </div>

              <Card className="print-break">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900">Searches per day</h2>
                  <ExportLink kind="analytics-daily" days={days} />
                </div>
                {daily.length ? (
                  <>
                    <div className="flex h-40 items-end gap-0.5" role="img" aria-label={`Searches per day over the last ${days} days`}>
                      {daily.map((d) => (
                        <div key={d.day} className="group relative flex h-full max-w-10 flex-1 items-end">
                          <div className="w-full bg-brand-500 transition group-hover:bg-brand-700" style={{ height: `${dayMax ? Math.max(2, (d.searches / dayMax) * 100) : 0}%`, borderRadius: "4px 4px 0 0" }} />
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
                            {d.day}: {d.searches} searches · {d.zero_results} with no route
                          </span>
                        </div>
                      ))}
                    </div>
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-slate-600">Show as table</summary>
                      <table className="mt-2 w-full text-left">
                        <thead>
                          <tr className="text-xs text-slate-500">
                            <th className="py-1">Day</th>
                            <th className="py-1 text-right">Searches</th>
                            <th className="py-1 text-right">No route found</th>
                          </tr>
                        </thead>
                        <tbody className="tabular-nums">
                          {daily.map((d) => (
                            <tr key={d.day} className="border-t border-slate-100">
                              <td className="py-1">{d.day}</td>
                              <td className="py-1 text-right">{d.searches}</td>
                              <td className="py-1 text-right">{d.zero_results}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No searches in this period yet.</p>
                )}
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <PairTable rows={a.missing_routes} title="Missing routes (searched, nothing found)" hint="Where route data is still missing. Add these first." kind="analytics-missing" days={days} />
                <PairTable rows={a.top_searches} title="Most searched trips" hint="What commuters look for most." kind="analytics-top" days={days} />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="print-break">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-bold text-slate-900">Most asked areas</h2>
                    <ExportLink kind="analytics-areas" days={days} />
                  </div>
                  {a.asked_areas.length ? (
                    <table className="w-full text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr>
                          <th className="py-1 text-left">Area</th>
                          <th className="py-1 text-right">Questions</th>
                          <th className="py-1 text-right">Unanswered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.asked_areas.map((x) => (
                          <tr key={x.area}>
                            <td className="py-1.5 pr-3">
                              {x.area}
                              <Bar value={x.questions} max={areaMax} />
                            </td>
                            <td className="py-1.5 text-right font-semibold tabular-nums">{x.questions}</td>
                            <td className="py-1.5 text-right tabular-nums text-slate-600">{x.unanswered}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-slate-500">No questions in this period yet.</p>
                  )}
                </Card>
                <Card className="print-break">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-bold text-slate-900">Oldest unanswered questions</h2>
                    <ExportLink kind="analytics-unanswered" days={days} />
                  </div>
                  {a.unanswered.length ? (
                    <ul className="divide-y divide-slate-100 text-sm">
                      {a.unanswered.map((q) => (
                        <li key={q.id} className="py-2">
                          <Link href={`/questions/${q.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                            {q.title}
                          </Link>
                          <p className="text-xs text-slate-500">{formatDateTime(q.created_at)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">Every question has an answer. 🎉</p>
                  )}
                </Card>
              </div>
            </div>
          )}
        </PendingResults>
      </QueryNav>
    </Container>
  );
}
