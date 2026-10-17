import { requestNow } from "@/lib/time";
import type { Metadata } from "next";
import Link from "next/link";
import { NotAllowed } from "@/components/admin-bits";
import { LiveRefresh } from "@/components/live-refresh";
import { ActionButton } from "@/components/ui/client";
import { Card, Chip, Container } from "@/components/ui/primitives";
import { deleteAdvisory } from "@/lib/actions/admin";
import { requireStaff } from "@/lib/admin";
import { TIME_ZONE } from "@/lib/env";
import { formatDateTime, toLocalInput } from "@/lib/format";
import { ADVISORY_KIND_LABEL } from "@/lib/modes";
import { ADVISORY } from "@/lib/queries";
import type { Advisory } from "@/lib/types";
import { AdvisoryForm } from "./advisory-form";

export const metadata: Metadata = { title: "Manage advisories" };

export default async function AdminAdvisoriesPage({ searchParams }: PageProps<"/admin/advisories">) {
  const viewer = await requireStaff("/admin/advisories");
  if (!viewer) return <NotAllowed />;
  const sp = await searchParams;
  const { data } = await viewer.supabase.from("advisories").select(ADVISORY).order("starts_at", { ascending: false }).limit(100);
  const all = (data ?? []) as Advisory[];
  const editing = all.find((a) => a.id === sp.edit) ?? null;
  const now = await requestNow();
  const state = (a: Advisory) =>
    a.ends_at && new Date(a.ends_at).getTime() <= now ? "ended" : new Date(a.starts_at).getTime() > now ? "upcoming" : "active";

  return (
    <Container className="space-y-4">
      <LiveRefresh tables={[{ table: "advisories" }]} boundaries={all.flatMap((a) => [a.starts_at, a.ends_at])} />
      <h1 className="text-2xl font-bold text-slate-900">Advisories</h1>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <ul className="space-y-2">
          {all.map((a) => {
            const s = state(a);
            return (
              <li key={a.id}>
                <Card className="space-y-1 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={s === "active" ? "emerald" : s === "upcoming" ? "blue" : "slate"}>{s}</Chip>
                    <Chip tone={a.severity === "critical" ? "rose" : a.severity === "warning" ? "amber" : "slate"}>{a.severity}</Chip>
                    <span className="text-xs text-slate-500">{ADVISORY_KIND_LABEL[a.kind]}</span>
                  </div>
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(a.starts_at)} → {a.ends_at ? formatDateTime(a.ends_at) : "no end"}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <Link href={`/admin/advisories?edit=${a.id}`} scroll={false} className="text-sm font-medium text-brand-700 hover:underline">
                      Edit
                    </Link>
                    <ActionButton variant="danger" size="sm" confirm="Delete this advisory permanently?" confirmLabel="Delete" action={deleteAdvisory.bind(null, a.id)}>
                      Delete
                    </ActionButton>
                  </div>
                </Card>
              </li>
            );
          })}
          {!all.length ? <li className="text-sm text-slate-500">No advisories yet.</li> : null}
        </ul>
        <Card className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-3 font-bold text-slate-900">{editing ? "Edit advisory" : "New advisory"}</h2>
          <AdvisoryForm
            timeZone={TIME_ZONE}
            advisory={
              editing
                ? {
                    id: editing.id,
                    title: editing.title,
                    body: editing.body ?? "",
                    kind: editing.kind,
                    severity: editing.severity,
                    area: editing.area ?? "",
                    starts_at: toLocalInput(editing.starts_at),
                    ends_at: toLocalInput(editing.ends_at),
                  }
                : null
            }
          />
        </Card>
      </div>
    </Container>
  );
}
