"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { fromLocalInput } from "@/lib/format";
import type { ActionState, ContentType, ReportStatus, RpcResult, UserRole } from "@/lib/types";
import { withRoadPaths } from "@/lib/road-paths-server";
import type { RouteDraft } from "./community";

// Every function here calls a database function that re-checks the caller's
// role and logs the attempt, so these are safe even if someone calls them
// directly from the browser.

async function staffRpc(fn: string, args: Record<string, unknown>, success: string): Promise<ActionState & { id?: string }> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: "Please sign in first." };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: friendlyError(error) };
  const result = data as RpcResult;
  if (!result?.ok) return { ok: false, message: result?.error ?? "That didn't work. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: success, at: Date.now(), id: result.id };
}

export async function moderateRoute(_: ActionState, formData: FormData): Promise<ActionState> {
  const decision = String(formData.get("decision"));
  const labels: Record<string, string> = { publish: "Route published.", reject: "Route rejected. The contributor will see your note.", archive: "Route archived.", pending: "Moved back to pending." };
  return staffRpc(
    "moderate_route",
    { p_route: String(formData.get("route_id")), p_decision: decision, p_note: String(formData.get("note") ?? "") },
    labels[decision] ?? "Updated.",
  );
}

export async function adminUpdateRoute(routeId: string, draft: RouteDraft): Promise<ActionState> {
  const { supabase } = await getViewer();
  return staffRpc("admin_update_route", { p_route_id: routeId, p_route: await withRoadPaths(supabase, draft) }, "Route updated.");
}

export async function resolveReport(_: ActionState, formData: FormData): Promise<ActionState> {
  const status = String(formData.get("status")) as ReportStatus;
  return staffRpc(
    "resolve_report",
    { p_report: String(formData.get("report_id")), p_status: status, p_note: String(formData.get("note") ?? "") },
    status === "resolved" ? "Marked as resolved." : status === "dismissed" ? "Report dismissed." : "Report reopened.",
  );
}

export async function setContentRemoved(type: ContentType, id: string, removed: boolean, reason = ""): Promise<ActionState> {
  return staffRpc("set_content_removed", { p_type: type, p_id: id, p_removed: removed, p_reason: reason }, removed ? "Removed." : "Restored.");
}

export async function mergeQuestion(_: ActionState, formData: FormData): Promise<ActionState> {
  const target = String(formData.get("target_id") ?? "").trim().split("/").pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(target)) return { ok: false, message: "Paste the link or ID of the question to merge into." };
  return staffRpc("merge_question", { p_source: String(formData.get("source_id")), p_target: target }, "Questions merged. Answers were moved to the main thread.");
}

export async function setQuestionClosed(id: string, closed: boolean): Promise<ActionState> {
  return staffRpc("set_question_closed", { p_question: id, p_closed: closed }, closed ? "Question closed." : "Question reopened.");
}

export async function upsertPlace(_: ActionState, formData: FormData): Promise<ActionState> {
  const list = (key: string) =>
    String(formData.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const place = {
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? ""),
    aliases: list("aliases"),
    kind: String(formData.get("kind") ?? "landmark"),
    city: String(formData.get("city") ?? ""),
    address: String(formData.get("address") ?? ""),
    description: String(formData.get("description") ?? ""),
    lat: Number(formData.get("lat")),
    lng: Number(formData.get("lng")),
    modes: formData.getAll("modes").map(String),
    hours_open: String(formData.get("hours_open") ?? ""),
    hours_close: String(formData.get("hours_close") ?? ""),
    hours_note: String(formData.get("hours_note") ?? ""),
    is_verified: formData.get("is_verified") === "on",
  };
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng) || (place.lat === 0 && place.lng === 0)) {
    return { ok: false, message: "Click the map to drop a pin for this place." };
  }
  return staffRpc("upsert_place", { p_place: place }, place.id ? "Place updated." : "Place added.");
}

export async function upsertAdvisory(_: ActionState, formData: FormData): Promise<ActionState> {
  const advisory = {
    id: String(formData.get("id") ?? ""),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    kind: String(formData.get("kind") ?? "other"),
    severity: String(formData.get("severity") ?? "info"),
    area: String(formData.get("area") ?? ""),
    starts_at: fromLocalInput(String(formData.get("starts_at") ?? "")),
    ends_at: fromLocalInput(String(formData.get("ends_at") ?? "")),
  };
  return staffRpc("upsert_advisory", { p_advisory: advisory }, advisory.id ? "Advisory updated." : "Advisory published.");
}

export async function deleteAdvisory(id: string): Promise<ActionState> {
  return staffRpc("delete_advisory", { p_id: id }, "Advisory deleted.");
}

export async function setUserRole(userId: string, role: UserRole): Promise<ActionState> {
  return staffRpc("set_user_role", { p_user: userId, p_role: role }, `Role changed to ${role}.`);
}

export async function setUserBanned(userId: string, banned: boolean): Promise<ActionState> {
  return staffRpc("set_user_banned", { p_user: userId, p_banned: banned }, banned ? "Member suspended." : "Suspension lifted.");
}

export type UserSearchRow = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  is_banned: boolean;
  points: number;
  email_masked: string | null;
  created_at: string;
};

export async function searchUsers(query: string): Promise<{ ok: boolean; message?: string; rows: UserSearchRow[] }> {
  const q = query.trim();
  if (q.length < 2) return { ok: true, rows: [] };
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: "Please sign in first.", rows: [] };
  const { data, error } = await supabase.rpc("search_users", { p_query: q });
  if (error) return { ok: false, message: friendlyError(error), rows: [] };
  return { ok: true, rows: (data ?? []) as UserSearchRow[] };
}
