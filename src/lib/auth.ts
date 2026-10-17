import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const PROFILE_COLUMNS =
  "id, username, display_name, bio, home_area, role, is_banned, points, routes_published_count, questions_count, answers_count, best_answers_count, upvotes_received, confirmations_count, created_at";

/**
 * The signed-in person for this request. The user id comes from the verified
 * JWT claims (no extra Auth round-trip); the profile is one indexed lookup.
 * Wrapped in React `cache` so every component in a request shares it.
 */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  let profile: Profile | null = null;
  if (userId) {
    const { data: p } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
    profile = (p as Profile | null) ?? null;
  }
  const active = profile && !profile.is_banned;
  return {
    supabase,
    userId,
    email: typeof claims?.email === "string" ? claims.email : null,
    profile,
    isStaff: Boolean(active && (profile!.role === "moderator" || profile!.role === "admin")),
    isAdmin: Boolean(active && profile!.role === "admin"),
  };
});

export type Viewer = Awaited<ReturnType<typeof getViewer>>;

export async function requireViewer(next: string) {
  const viewer = await getViewer();
  if (!viewer.userId) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer;
}
