import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/server";

// Public, cookie-free lookups used for metadata and share images. Cached
// briefly so link previews (Facebook/Messenger crawlers) are fast.

export type RouteMeta = {
  id: string;
  title: string;
  summary: string | null;
  total_fare: number;
  total_minutes: number;
  modes: string[];
  origin: { name: string } | null;
  destination: { name: string } | null;
} | null;

export async function getPublicRouteMeta(id: string): Promise<RouteMeta> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`route:${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const { data } = await createAnonClient()
      .from("routes")
      .select(
        "id, title, summary, total_fare, total_minutes, modes, origin:places!routes_origin_place_id_fkey(name), destination:places!routes_destination_place_id_fkey(name)",
      )
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    return (data as unknown as RouteMeta) ?? null;
  } catch {
    return null;
  }
}

export async function getPublicQuestionMeta(id: string): Promise<{ title: string; answer_count: number } | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`question:${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const { data } = await createAnonClient().from("questions").select("title, answer_count").eq("id", id).eq("is_removed", false).maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}
