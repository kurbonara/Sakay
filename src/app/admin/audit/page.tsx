import { Download } from "lucide-react";
import type { Metadata } from "next";
import { NotAllowed } from "@/components/admin-bits";
import { LiveRefresh } from "@/components/live-refresh";
import { FilterTabs, PendingResults, QueryNav } from "@/components/query-nav";
import { QuestionListSkeleton } from "@/components/skeletons";
import { Chip, Container, buttonClasses } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

type Entry = { id: number; created_at: string; action: string; target_type: string | null; target_id: string | null; success: boolean; details: Record<string, unknown>; actor: { username: string; display_name: string } | null };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const viewer = await requireStaff("/admin/audit", true);
  if (!viewer) return <NotAllowed adminOnly />;
  const sp = await searchParams;
  const filter = sp.filter === "rejected" ? "rejected" : "";
  let query = viewer.supabase.from("audit_log").select("id, created_at, action, target_type, target_id, success, details, actor:profiles!audit_log_actor_id_fkey(username, display_name)");
  if (filter) query = query.eq("success", false);
  const { data } = await query.order("created_at", { ascending: false }).limit(200);
  const entries = (data ?? []) as unknown as Entry[];

  return (
    <Container className="space-y-4">
      <LiveRefresh tables={[]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
        <a href="/admin/export/audit" download className={buttonClasses("secondary", "sm")}>
          <Download className="size-4" aria-hidden /> CSV
        </a>
      </div>
      <p className="text-sm text-slate-600">Who did what and when, including attempts that were refused.</p>
      <QueryNav>
        <FilterTabs param="filter" label="Audit filter" options={[{ value: "", label: "Everything" }, { value: "rejected", label: "Refused attempts" }]} />
        <div className="mt-3">
          <PendingResults fallback={<QuestionListSkeleton rows={10} />}>
            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Who</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDateTime(e.created_at)}</td>
                      <td className="px-3 py-2">{e.actor ? `@${e.actor.username}` : "system"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {e.target_type} {e.target_id?.slice(0, 8)}
                        {Object.keys(e.details ?? {}).length ? <span className="block truncate text-slate-400">{JSON.stringify(e.details).slice(0, 80)}</span> : null}
                      </td>
                      <td className="px-3 py-2">{e.success ? <Chip tone="emerald">ok</Chip> : <Chip tone="rose">refused</Chip>}</td>
                    </tr>
                  ))}
                  {!entries.length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                        No entries.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </PendingResults>
        </div>
      </QueryNav>
    </Container>
  );
}
