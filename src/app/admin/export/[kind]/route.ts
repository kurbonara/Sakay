import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/admin";
import { getViewer } from "@/lib/auth";

// CSV downloads for staff. Every query still runs through RLS / staff-only RPCs,
// so this can't leak anything the signed-in person couldn't already see.
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/export/[kind]">) {
  const { kind } = await ctx.params;
  const { supabase, isStaff, isAdmin } = await getViewer();
  if (!isStaff) return new Response("Moderators only. Sign in with a moderator account and try again.", { status: 403 });
  const sp = request.nextUrl.searchParams;
  let rows: Record<string, unknown>[] = [];
  let columns: string[] | undefined;

  if (kind === "reports") {
    const status = ["open", "resolved", "dismissed"].includes(sp.get("status") ?? "") ? sp.get("status")! : "open";
    const { data, error } = await supabase
      .from("reports")
      .select("id, target_type, target_id, reason, details, status, created_at, resolved_at, resolution_note, reporter:profiles!reports_reporter_id_fkey(username)")
      .eq("status", status)
      .order("created_at");
    if (error) return new Response(error.message, { status: 500 });
    rows = ((data ?? []) as unknown as (Record<string, unknown> & { reporter: { username: string } | null })[]).map(({ reporter, ...r }) => ({ ...r, reporter: reporter?.username ?? "" }));
  } else if (kind.startsWith("analytics-")) {
    const days = Number(sp.get("days") ?? 30);
    const { data, error } = await supabase.rpc("admin_analytics", { p_days: days });
    if (error) return new Response(error.message, { status: 500 });
    const sections: Record<string, string> = { "analytics-top": "top_searches", "analytics-missing": "missing_routes", "analytics-areas": "asked_areas", "analytics-unanswered": "unanswered", "analytics-daily": "searches_by_day" };
    const section = sections[kind];
    if (!section) return new Response("Unknown export", { status: 404 });
    rows = (data?.[section] ?? []) as Record<string, unknown>[];
  } else if (kind === "audit") {
    if (!isAdmin) return new Response("Admins only.", { status: 403 });
    const { data, error } = await supabase.from("audit_log").select("id, created_at, action, target_type, target_id, success, details, actor:profiles!audit_log_actor_id_fkey(username)").order("created_at", { ascending: false }).limit(5000);
    if (error) return new Response(error.message, { status: 500 });
    rows = ((data ?? []) as unknown as (Record<string, unknown> & { actor: { username: string } | null })[]).map(({ actor, ...r }) => ({ ...r, actor: actor?.username ?? "" }));
    columns = ["id", "created_at", "actor", "action", "target_type", "target_id", "success", "details"];
  } else {
    return new Response("Unknown export", { status: 404 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sakay-${kind}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
