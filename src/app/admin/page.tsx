import type { Metadata } from "next";
import Link from "next/link";
import { NotAllowed, StatCard } from "@/components/admin-bits";
import { LiveRefresh } from "@/components/live-refresh";
import { Card, Chip, Container } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { REPORT_REASON_LABEL } from "@/lib/modes";

export const metadata: Metadata = { title: "Admin" };

type Overview = {
  pending_routes: number;
  open_reports: number;
  unanswered_questions: number;
  published_routes: number;
  members: number;
  searches_7d: number;
  zero_result_searches_7d: number;
  active_advisories: number;
};

export default async function AdminHome() {
  const viewer = await requireStaff("/admin");
  if (!viewer) return <NotAllowed />;
  const { supabase } = viewer;
  const [overview, pending, reports] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.from("routes").select("id, title, created_at, submitter:profiles!routes_submitted_by_fkey(display_name)").eq("status", "pending").order("created_at").limit(5),
    supabase.from("reports").select("id, target_type, reason, created_at").eq("status", "open").order("created_at").limit(5),
  ]);
  const o = (overview.data ?? {}) as Overview;
  const pendingRows = (pending.data ?? []) as unknown as { id: string; title: string; created_at: string; submitter: { display_name: string } | null }[];
  const reportRows = (reports.data ?? []) as { id: string; target_type: string; reason: string; created_at: string }[];

  return (
    <Container className="space-y-6">
      <LiveRefresh tables={[{ table: "routes" }, { table: "reports" }, { table: "questions" }]} />
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending routes" value={o.pending_routes ?? 0} href="/admin/routes" tone={o.pending_routes ? "amber" : "slate"} />
        <StatCard label="Open reports" value={o.open_reports ?? 0} href="/admin/reports" tone={o.open_reports ? "rose" : "slate"} />
        <StatCard label="Unanswered questions" value={o.unanswered_questions ?? 0} href="/admin/questions?tab=unanswered" tone="blue" />
        <StatCard label="Published routes" value={o.published_routes ?? 0} href="/routes" tone="emerald" />
        <StatCard label="Members" value={o.members ?? 0} href="/admin/users" />
        <StatCard label="Searches (7 days)" value={o.searches_7d ?? 0} href="/admin/analytics?days=7" />
        <StatCard label="Searches with no result (7d)" value={o.zero_result_searches_7d ?? 0} href="/admin/analytics?days=7" tone={o.zero_result_searches_7d ? "amber" : "slate"} />
        <StatCard label="Active advisories" value={o.active_advisories ?? 0} href="/admin/advisories" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Oldest pending routes</h2>
            <Link href="/admin/routes" className="text-sm font-medium text-brand-700 hover:underline">
              Review all →
            </Link>
          </div>
          {pendingRows.length ? (
            <ul className="divide-y divide-slate-100">
              {pendingRows.map((r) => (
                <li key={r.id} className="py-2">
                  <Link href={`/routes/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {r.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {r.submitter?.display_name ?? "former member"} · {formatDateTime(r.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nothing waiting. Nice!</p>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Oldest open reports</h2>
            <Link href="/admin/reports" className="text-sm font-medium text-brand-700 hover:underline">
              Handle all →
            </Link>
          </div>
          {reportRows.length ? (
            <ul className="divide-y divide-slate-100">
              {reportRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {REPORT_REASON_LABEL[r.reason]} <Chip>{r.target_type}</Chip>
                  </span>
                  <span className="text-xs text-slate-500">{formatDateTime(r.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No open reports.</p>
          )}
        </Card>
      </div>
    </Container>
  );
}
