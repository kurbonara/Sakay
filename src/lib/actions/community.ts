"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { ActionState, ContentType, PlaceKind, ReportReason } from "@/lib/types";

const SIGN_IN = "Please sign in first.";

function done(message: string, extra: Partial<NonNullable<ActionState>> = {}): ActionState {
  revalidatePath("/", "layout");
  return { ok: true, message, at: Date.now(), ...extra };
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------
export type RouteDraft = {
  title: string;
  summary?: string;
  operating_hours?: string;
  pwd_friendly?: boolean;
  senior_friendly?: boolean;
  heavy_load_friendly?: boolean;
  accessibility_notes?: string;
  legs: {
    mode: string;
    from_place_id: string;
    to_place_id: string;
    signboard?: string;
    instructions?: string;
    fare?: number | string;
    fare_discounted?: number | string | null;
    minutes: number | string;
  }[];
};

export async function submitRoute(draft: RouteDraft): Promise<ActionState> {
  const { supabase, userId, isStaff } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  if (!draft.title || draft.title.trim().length < 5) return { ok: false, message: "Give the route a title (at least 5 characters)." };
  const { data, error } = await supabase.rpc("submit_route", { p_route: draft });
  if (error) return { ok: false, message: friendlyError(error) };
  return done(
    isStaff ? "Route published." : "Thanks! Your route was sent to the moderators. You'll see it under Account → My submissions.",
    { redirectTo: `/routes/${data}` },
  );
}

export async function suggestPlace(input: { name: string; kind: PlaceKind; lat: number; lng: number; city?: string }) {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false as const, message: SIGN_IN };
  const { data, error } = await supabase.rpc("suggest_place", {
    p_name: input.name,
    p_kind: input.kind,
    p_lat: input.lat,
    p_lng: input.lng,
    p_city: input.city ?? null,
    p_address: null,
  });
  if (error) return { ok: false as const, message: friendlyError(error) };
  return { ok: true as const, id: data as string, message: "Place added." };
}

export async function toggleSaveRoute(routeId: string): Promise<ActionState & { saved?: boolean }> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const { data, error } = await supabase.rpc("toggle_save_route", { p_route: routeId });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: data ? "Saved. You can open it from Saved routes, even offline." : "Removed from saved routes.", saved: Boolean(data) };
}

export async function confirmRoute(routeId: string, isAccurate: boolean | null): Promise<ActionState> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const { error } = await supabase.rpc("confirm_route", { p_route: routeId, p_is_accurate: isAccurate });
  if (error) return { ok: false, message: friendlyError(error) };
  return done(isAccurate === null ? "Your confirmation was removed." : isAccurate ? "Thanks for confirming!" : "Thanks! Consider reporting what changed so we can fix it.");
}

export async function addRouteComment(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const { error } = await supabase.rpc("add_route_comment", {
    p_route: String(formData.get("route_id")),
    p_kind: formData.get("kind") === "comment" ? "comment" : "tip",
    p_body: String(formData.get("body") ?? ""),
  });
  if (error) return { ok: false, message: friendlyError(error) };
  return done("Posted. Thanks for the tip!");
}

export async function createReport(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const { error } = await supabase.rpc("create_report", {
    p_type: String(formData.get("target_type")) as ContentType,
    p_target: String(formData.get("target_id")),
    p_reason: String(formData.get("reason")) as ReportReason,
    p_details: String(formData.get("details") ?? ""),
  });
  if (error) return { ok: false, message: friendlyError(error) };
  return done("Report sent. Moderators will review it. Thanks for keeping Sakay accurate!");
}

// ----------------------------------------------------------------------------
// Q&A
// ----------------------------------------------------------------------------
export async function askQuestion(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const none = (v: FormDataEntryValue | null) => (v && String(v).trim() ? String(v) : null);
  const { data, error } = await supabase.rpc("ask_question", {
    p_title: String(formData.get("title") ?? ""),
    p_body: String(formData.get("body") ?? ""),
    p_origin: none(formData.get("origin_id")),
    p_destination: none(formData.get("destination_id")),
    p_origin_text: none(formData.get("origin_text")),
    p_destination_text: none(formData.get("destination_text")),
  });
  if (error) return { ok: false, message: friendlyError(error) };
  return done("Question posted! We'll show new answers here as they come in.", { redirectTo: `/questions/${data}` });
}

export async function postAnswer(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const route = String(formData.get("route_id") ?? "").trim();
  const { error } = await supabase.rpc("post_answer", {
    p_question: String(formData.get("question_id")),
    p_body: String(formData.get("body") ?? ""),
    p_route: route || null,
  });
  if (error) return { ok: false, message: friendlyError(error) };
  return done("Answer posted. Salamat sa pagtulong!");
}

export async function voteAnswer(answerId: string, value: -1 | 0 | 1): Promise<ActionState & { score?: number }> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const { data, error } = await supabase.rpc("vote_answer", { p_answer: answerId, p_value: value });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "", score: data as number };
}

export async function markBestAnswer(answerId: string): Promise<ActionState> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const { data, error } = await supabase.rpc("mark_best_answer", { p_answer: answerId });
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.ok) return { ok: false, message: data?.error ?? "Couldn't update the best answer." };
  return done("Best answer updated.");
}

export async function editOwnContent(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const { error } = await supabase.rpc("edit_own_content", {
    p_type: String(formData.get("type")) as ContentType,
    p_id: String(formData.get("id")),
    p_body: String(formData.get("body") ?? ""),
    p_title: formData.get("title") ? String(formData.get("title")) : null,
  });
  if (error) return { ok: false, message: friendlyError(error) };
  return done("Changes saved.");
}

export async function deleteOwnContent(type: ContentType, id: string): Promise<ActionState> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const { error } = await supabase.rpc("delete_own_content", { p_type: type, p_id: id });
  if (error) return { ok: false, message: friendlyError(error) };
  return done("Deleted.");
}

// ----------------------------------------------------------------------------
// Profile
// ----------------------------------------------------------------------------
export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, userId } = await getViewer();
  if (!userId) return { ok: false, message: SIGN_IN };
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return { ok: false, message: "Usernames use 3-24 lowercase letters, numbers or underscores." };
  }
  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: String(formData.get("display_name") ?? "").trim(),
      bio: String(formData.get("bio") ?? "").trim() || null,
      home_area: String(formData.get("home_area") ?? "").trim() || null,
    })
    .eq("id", userId);
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That username is taken. Try another one." };
    if (error.code === "23514") return { ok: false, message: "Check your name (1-60 characters) and bio (up to 280)." };
    return { ok: false, message: friendlyError(error) };
  }
  return done("Profile saved.");
}
