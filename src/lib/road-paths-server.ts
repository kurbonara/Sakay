import "server-only";
import type { RouteDraft } from "@/lib/actions/community";
import type { Viewer } from "@/lib/auth";
import { fetchRoadPath } from "@/lib/road-paths";
import type { TransportMode } from "@/lib/types";

/**
 * Looks up road-following geometry for each leg once, at save time, so the map
 * shows real roads for everyone without calling the routing server per view.
 * Best effort: a slow or failed lookup just leaves the leg without a path.
 */
export async function withRoadPaths(supabase: Viewer["supabase"], draft: RouteDraft): Promise<RouteDraft> {
  const ids = [...new Set(draft.legs.flatMap((l) => [l.from_place_id, l.to_place_id]).filter(Boolean))];
  if (!ids.length) return draft;
  const { data } = await supabase.from("places").select("id, lat, lng").in("id", ids);
  const at = new Map((data ?? []).map((p) => [p.id as string, p as { lat: number; lng: number }]));
  const legs = await Promise.all(
    draft.legs.map(async (l) => {
      const from = at.get(l.from_place_id);
      const to = at.get(l.to_place_id);
      if (!from || !to) return l;
      const path = await fetchRoadPath(l.mode as TransportMode, from, to, AbortSignal.timeout(5000));
      return path ? { ...l, path } : l;
    }),
  );
  return { ...draft, legs };
}
