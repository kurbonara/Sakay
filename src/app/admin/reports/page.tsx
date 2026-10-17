import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NotAllowed } from "@/components/admin-bits";
import { LiveRefresh } from "@/components/live-refresh";
import { PrintButton } from "@/components/route-actions";
import { FilterTabs, PendingResults, QueryNav } from "@/components/query-nav";
import { QuestionListSkeleton } from "@/components/skeletons";
import { Card, Chip, Container, EmptyState, buttonClasses } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { I18nProvider } from "@/lib/i18n/client";
import { REPORT_REASON_LABEL } from "@/lib/modes";
import type { Report, ReportStatus } from "@/lib/types";
import { ResolveForm } from "./resolve-form";

export const metadata: Metadata = { title: "Reports" };

const STATUSES: ReportStatus[] = ["open", "resolved", "dismissed"];

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const viewer = await requireStaff("/admin/reports");
  if (!viewer) return <NotAllowed />;
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as ReportStatus) ? (sp.status as ReportStatus) : "open";
  const { supabase } = viewer;
  const { data } = await supabase
    .from("reports")
    .select(
      "id, target_type, target_id, reason, details, status, created_at, resolved_at, resolution_note, reporter:profiles!reports_reporter_id_fkey(id, username, display_name, role), resolver:profiles!reports_resolved_by_fkey(id, username, display_name, role)",
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "open" })
    .limit(100);
  const reports = (data ?? []) as unknown as Report[];

  // Look up what each report points at (in parallel, one query per type).
  const idsBy = (type: string) => reports.filter((r) => r.target_type === type).map((r) => r.target_id);
  const [routes, questions, answers, comments, places] = await Promise.all([
    idsBy("route").length ? supabase.from("routes").select("id, title").in("id", idsBy("route")) : Promise.resolve({ data: [] }),
    idsBy("question").length ? supabase.from("questions").select("id, title").in("id", idsBy("question")) : Promise.resolve({ data: [] }),
    idsBy("answer").length ? supabase.from("answers").select("id, body, question_id").in("id", idsBy("answer")) : Promise.resolve({ data: [] }),
    idsBy("comment").length ? supabase.from("route_comments").select("id, body, route_id").in("id", idsBy("comment")) : Promise.resolve({ data: [] }),
    idsBy("place").length ? supabase.from("places").select("id, name").in("id", idsBy("place")) : Promise.resolve({ data: [] }),
  ]);
  const target = new Map<string, { label: string; href: string }>();
  for (const r of (routes.data ?? []) as { id: string; title: string }[]) target.set(r.id, { label: r.title, href: `/routes/${r.id}` });
  for (const q of (questions.data ?? []) as { id: string; title: string }[]) target.set(q.id, { label: q.title, href: `/questions/${q.id}?stay=1` });
  for (const a of (answers.data ?? []) as { id: string; body: string; question_id: string }[]) target.set(a.id, { label: a.body.slice(0, 120), href: `/questions/${a.question_id}?stay=1` });
  for (const c of (comments.data ?? []) as { id: string; body: string; route_id: string }[]) target.set(c.id, { label: c.body.slice(0, 120), href: `/routes/${c.route_id}` });
  for (const p of (places.data ?? []) as { id: string; name: string }[]) target.set(p.id, { label: p.name, href: `/places/${p.id}` });

  return (
    <I18nProvider lang="en">
      <Container className="space-y-4">
        <LiveRefresh tables={[{ table: "reports" }]} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <div className="no-print flex gap-2">
            <PrintButton />
            <a href={`/admin/export/reports?status=${status}`} className={buttonClasses("secondary", "sm")}>
              <Download className="size-4" aria-hidden /> CSV
            </a>
          </div>
        </div>
        <QueryNav>
          <div className="no-print">
            <FilterTabs param="status" defaultValue="open" label="Report status" options={STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
          </div>
          <div className="mt-4">
            <PendingResults fallback={<QuestionListSkeleton rows={4} />}>
              {reports.length ? (
                <ul className="space-y-3">
                  {reports.map((r) => {
                    const tg = target.get(r.target_id);
                    return (
                      <li key={r.id}>
                        <Card className="print-break grid gap-4 md:grid-cols-[1.4fr_1fr]">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Chip tone="rose">{REPORT_REASON_LABEL[r.reason]}</Chip>
                              <Chip>{r.target_type}</Chip>
                            </div>
                            {tg ? (
                              <Link href={tg.href} className="block font-medium text-slate-900 hover:text-brand-700">
                                {tg.label}
                              </Link>
                            ) : (
                              <p className="text-sm text-slate-500">(item no longer visible)</p>
                            )}
                            {r.details ? <p className="whitespace-pre-line text-sm text-slate-700">“{r.details}”</p> : null}
                            <p className="text-xs text-slate-500">
                              Reported by {r.reporter?.display_name ?? "former member"} · {formatDateTime(r.created_at)}
                            </p>
                            {r.status !== "open" ? (
                              <p className="text-xs text-slate-500">
                                {r.status} by {r.resolver?.display_name ?? "?"} · {formatDateTime(r.resolved_at)}
                                {r.resolution_note ? ` · “${r.resolution_note}”` : ""}
                              </p>
                            ) : null}
                          </div>
                          <ResolveForm reportId={r.id} status={r.status} targetType={r.target_type} targetId={r.target_id} />
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title={`No ${status} reports.`} />
              )}
            </PendingResults>
          </div>
        </QueryNav>
      </Container>
    </I18nProvider>
  );
}
