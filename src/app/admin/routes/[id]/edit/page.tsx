import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotAllowed } from "@/components/admin-bits";
import { RouteForm, type RouteFormInitial } from "@/components/route-form";
import { Container, PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/admin";
import { modeLabels } from "@/lib/labels";
import { ROUTE_DETAIL } from "@/lib/queries";
import type { RouteDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Edit route" };

export default async function EditRoutePage({ params }: PageProps<"/admin/routes/[id]/edit">) {
  const { id } = await params;
  const viewer = await requireStaff(`/admin/routes/${id}/edit`);
  if (!viewer) return <NotAllowed />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data }, modes] = await Promise.all([viewer.supabase.from("routes").select(ROUTE_DETAIL).eq("id", id).maybeSingle(), modeLabels()]);
  const route = data as unknown as RouteDetail | null;
  if (!route) notFound();
  const initial: RouteFormInitial = {
    title: route.title,
    summary: route.summary ?? "",
    operating_hours: route.operating_hours ?? "",
    pwd_friendly: route.pwd_friendly,
    senior_friendly: route.senior_friendly,
    heavy_load_friendly: route.heavy_load_friendly,
    accessibility_notes: route.accessibility_notes ?? "",
    legs: [...route.legs]
      .sort((a, b) => a.seq - b.seq)
      .map((l) => ({
        key: l.id,
        mode: l.mode,
        from: l.from,
        to: l.to,
        signboard: l.signboard ?? "",
        instructions: l.instructions ?? "",
        fare: String(l.fare),
        fare_discounted: l.fare_discounted === null ? "" : String(l.fare_discounted),
        minutes: String(l.minutes),
      })),
  };
  return (
    <Container className="max-w-3xl">
      <PageHeader title="Edit route" subtitle={`Status: ${route.status}. Saving also clears the "sample" flag.`} />
      <RouteForm initial={initial} routeId={route.id} modeLabels={modes} />
    </Container>
  );
}
