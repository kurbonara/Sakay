import type { Metadata } from "next";
import Link from "next/link";
import { NotAllowed } from "@/components/admin-bits";
import { LiveRefresh } from "@/components/live-refresh";
import { FilterTabs, PendingResults, QueryNav } from "@/components/query-nav";
import { QuestionListSkeleton } from "@/components/skeletons";
import { Card, Chip, Container, EmptyState } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { MergeInto, RemoveToggle } from "./question-row-actions";

export const metadata: Metadata = { title: "Moderate questions" };

type Row = { id: string; title: string; status: string; answer_count: number; is_removed: boolean; created_at: string; origin_place_id: string | null; destination_place_id: string | null; origin_text: string | null; destination_text: string | null };

export default async function AdminQuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  const viewer = await requireStaff("/admin/questions");
  if (!viewer) return <NotAllowed />;
  const sp = await searchParams;
  const tab = ["unanswered", "duplicates", "removed", "all"].includes(String(sp.tab)) ? String(sp.tab) : "duplicates";
  const cols = "id, title, status, answer_count, is_removed, created_at, origin_place_id, destination_place_id, origin_text, destination_text";
  let query = viewer.supabase.from("questions").select(cols).neq("status", "merged");
  if (tab === "unanswered") query = query.eq("status", "open").eq("is_removed", false).order("created_at");
  else if (tab === "removed") query = query.eq("is_removed", true).order("created_at", { ascending: false });
  else if (tab === "duplicates") query = query.eq("is_removed", false).not("origin_place_id", "is", null).not("destination_place_id", "is", null).order("created_at");
  else query = query.order("created_at", { ascending: false });
  const { data } = await query.limit(300);
  const rows = (data ?? []) as Row[];

  // Same origin + destination = likely duplicate. Oldest thread (most answers first) is the main one.
  const groups = new Map<string, Row[]>();
  if (tab === "duplicates") {
    for (const r of rows) {
      const k = `${r.origin_place_id}|${r.destination_place_id}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1).map((g) => [...g].sort((a, b) => b.answer_count - a.answer_count || a.created_at.localeCompare(b.created_at)));

  return (
    <Container className="space-y-4">
      <LiveRefresh tables={[{ table: "questions" }]} />
      <h1 className="text-2xl font-bold text-slate-900">Questions</h1>
      <QueryNav>
        <FilterTabs
          param="tab"
          defaultValue="duplicates"
          label="Question filter"
          options={[
            { value: "duplicates", label: "Likely duplicates" },
            { value: "unanswered", label: "Unanswered" },
            { value: "removed", label: "Removed" },
            { value: "all", label: "All" },
          ]}
        />
        <div className="mt-4">
          <PendingResults fallback={<QuestionListSkeleton rows={6} />}>
            {tab === "duplicates" ? (
              dupGroups.length ? (
                <div className="space-y-3">
                  {dupGroups.map((g) => (
                    <Card key={g[0].id}>
                      <p className="mb-2 text-sm font-semibold text-slate-700">
                        {g[0].origin_text ?? "?"} → {g[0].destination_text ?? "?"} <Chip tone="amber">{g.length} threads</Chip>
                      </p>
                      <ul className="divide-y divide-slate-100">
                        {g.map((q, i) => (
                          <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <div className="min-w-0">
                              <Link href={`/questions/${q.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                                {q.title}
                              </Link>
                              <p className="text-xs text-slate-500">
                                {q.answer_count} answers · {formatDateTime(q.created_at)} {i === 0 ? <Chip tone="emerald">main thread</Chip> : null}
                              </p>
                            </div>
                            {i > 0 ? <MergeInto sourceId={q.id} targetId={g[0].id} targetTitle={g[0].title} /> : null}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title="No likely duplicates right now." body="Questions asking about the same origin and destination will be grouped here." />
              )
            ) : rows.length ? (
              <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
                {rows.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <Link href={`/questions/${q.id}?stay=1`} className="font-medium text-slate-900 hover:text-brand-700">
                        {q.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {q.status} · {q.answer_count} answers · {formatDateTime(q.created_at)}
                      </p>
                    </div>
                    <RemoveToggle id={q.id} removed={q.is_removed} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing here." />
            )}
          </PendingResults>
        </div>
      </QueryNav>
    </Container>
  );
}
