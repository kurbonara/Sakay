import type { TransportMode } from "@/lib/types";

// Road-following geometry for a leg, from an OSRM routing server.
// Default: the free OpenStreetMap community server (FOSSGIS). For heavy traffic,
// point NEXT_PUBLIC_ROUTING_URL at your own OSRM instance.
const ROUTING_URL = (process.env.NEXT_PUBLIC_ROUTING_URL || "https://routing.openstreetmap.de").replace(/\/+$/, "");

type Pt = { lat: number; lng: number };
export type LatLng = [number, number];

/** Walks follow footpaths; every vehicle (incl. trains, which run along EDSA/Aurora/Taft) follows roads. */
export function routingProfile(mode: TransportMode): "foot" | "car" {
  return mode === "walk" ? "foot" : "car";
}

export function pathKey(mode: TransportMode, from: Pt, to: Pt): string {
  const r = (n: number) => n.toFixed(5);
  return `${routingProfile(mode)}:${r(from.lat)},${r(from.lng)};${r(to.lat)},${r(to.lng)}`;
}

/** Returns [lat, lng] points along the road, or null if the router can't help (caller draws a straight line). */
export async function fetchRoadPath(mode: TransportMode, from: Pt, to: Pt, signal?: AbortSignal): Promise<LatLng[] | null> {
  if (mode === "ferry") return null; // boats don't follow roads
  const profile = routingProfile(mode);
  const url = `${ROUTING_URL}/routed-${profile}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=geojson`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { code?: string; routes?: { geometry: { coordinates: [number, number][] } }[] };
    const coords = data.code === "Ok" ? data.routes?.[0]?.geometry.coordinates : undefined;
    if (!coords || coords.length < 2) return null;
    return coords.map(([lng, lat]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))] as LatLng);
  } catch {
    return null;
  }
}
