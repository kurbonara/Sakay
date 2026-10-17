import type { Metadata } from "next";
import Link from "next/link";
import { NotAllowed } from "@/components/admin-bits";
import { LiveRefresh } from "@/components/live-refresh";
import { FilterTabs, PendingResults, QueryNav, SearchField } from "@/components/query-nav";
import { QuestionListSkeleton } from "@/components/skeletons";
import { Card, Chip, Container } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/admin";
import { PLACE_KIND_LABEL } from "@/lib/modes";
import { PLACE_FULL, pgrstSafe } from "@/lib/queries";
import type { Place } from "@/lib/types";
import { PlaceForm } from "./place-form";

export const metadata: Metadata = { title: "Places" };

export default async function AdminPlacesPage({ searchParams }: PageProps<"/admin/places">) {
  const viewer = await requireStaff("/admin/places");
  if (!viewer) return <NotAllowed />;
  const sp = await searchParams;
  const q = pgrstSafe(typeof sp.q === "string" ? sp.q : "").toLowerCase();
  const filter = sp.filter === "unverified" ? "unverified" : "";
  const editId = typeof sp.edit === "string" && /^[0-9a-f-]{36}$/i.test(sp.edit) ? sp.edit : null;
  const { supabase } = viewer;
  let query = supabase.from("places").select(PLACE_FULL);
  if (q) query = query.ilike("search_text", `%${q.replace(/_/g, "\\_")}%`);
  if (filter) query = query.eq("is_verified", false);
  const [{ data }, editRes] = await Promise.all([
    query.order("name").limit(100),
    editId ? supabase.from("places").select(PLACE_FULL).eq("id", editId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const places = (data ?? []) as Place[];
  const editing = (editRes.data as Place | null) ?? null;

  return (
    <Container className="space-y-4">
      <LiveRefresh tables={[{ table: "places" }]} />
      <h1 className="text-2xl font-bold text-slate-900">Places, terminals & stations</h1>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div>
          <QueryNav>
            <div className="space-y-3">
              <SearchField placeholder="Search places" label="Search places" />
              <FilterTabs param="filter" label="Place filter" options={[{ value: "", label: "All" }, { value: "unverified", label: "Needs review" }]} />
            </div>
            <div className="mt-3">
              <PendingResults fallback={<QuestionListSkeleton rows={8} />}>
                <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
                  {places.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          {PLACE_KIND_LABEL[p.kind]} {p.city ? `· ${p.city}` : ""} {!p.is_verified ? <Chip tone="amber">unverified</Chip> : null}
                        </p>
                      </div>
                      <Link href={`/admin/places?edit=${p.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} scroll={false} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
                        Edit
                      </Link>
                    </li>
                  ))}
                  {!places.length ? <li className="px-4 py-6 text-center text-sm text-slate-500">No places match.</li> : null}
                </ul>
              </PendingResults>
            </div>
          </QueryNav>
        </div>
        <Card className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-3 font-bold text-slate-900">{editing ? `Edit: ${editing.name}` : "Add a place"}</h2>
          <PlaceForm place={editing} />
        </Card>
      </div>
    </Container>
  );
}
