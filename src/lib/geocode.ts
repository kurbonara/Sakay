import type { PlaceKind } from "@/lib/types";

// Place search for anything not yet in Sakay, using OpenStreetMap data through
// the free Photon geocoder (https://photon.komoot.io). Fair use only; set
// NEXT_PUBLIC_GEOCODER_URL to your own Photon server if traffic grows.
const GEOCODER_URL = (process.env.NEXT_PUBLIC_GEOCODER_URL || "https://photon.komoot.io").replace(/\/+$/, "");
const PH_BBOX = "116.9,4.5,126.6,21.2"; // lon/lat box around the Philippines

export type MapPlace = {
  id: string; // "osm:N123" style; not a Sakay place id
  name: string;
  kind: PlaceKind;
  city: string | null;
  subtitle: string | null;
  lat: number;
  lng: number;
  source: "map";
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    type?: string;
  };
};

function kindOf(key = "", value = ""): PlaceKind {
  if (value === "mall" || value === "department_store" || value === "supermarket") return "mall";
  if (["school", "university", "college", "kindergarten"].includes(value)) return "school";
  if (value === "place_of_worship" || value === "church" || value === "cathedral") return "church";
  if (value === "bus_station" || value === "terminal" || value === "ferry_terminal") return "terminal";
  if (value === "station" || value === "halt" || value === "stop" || value === "platform" || key === "railway") return "station";
  if (value === "hospital" || value === "clinic") return "hospital";
  if (value === "townhall" || value === "government" || value === "police") return "government";
  if (value === "marketplace") return "market";
  return "landmark";
}

export function isInPhilippines(lat: number, lng: number): boolean {
  return lat >= 4 && lat <= 22 && lng >= 116 && lng <= 127;
}

/** Search OpenStreetMap places in the Philippines. Returns [] on any failure. */
export async function geocode(query: string, opts: { limit?: number; signal?: AbortSignal; userAgent?: string } = {}): Promise<MapPlace[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${GEOCODER_URL}/api/?q=${encodeURIComponent(q)}&limit=${opts.limit ?? 5}&lang=en&bbox=${PH_BBOX}`;
  try {
    const res = await fetch(url, { signal: opts.signal, headers: opts.userAgent ? { "User-Agent": opts.userAgent } : undefined });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    const out: MapPlace[] = [];
    for (const f of data.features ?? []) {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      if (!p.name || !isInPhilippines(lat, lng)) continue;
      const town = p.city ?? p.county ?? null;
      const key = `${p.name}|${town}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `osm:${p.osm_type ?? ""}${p.osm_id ?? `${lat},${lng}`}`,
        name: p.name,
        kind: kindOf(p.osm_key, p.osm_value),
        city: town,
        subtitle: [p.street, p.district, town, p.state].filter((x, i, a) => x && a.indexOf(x) === i).join(", ") || null,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        source: "map",
      });
    }
    return out;
  } catch {
    return [];
  }
}
