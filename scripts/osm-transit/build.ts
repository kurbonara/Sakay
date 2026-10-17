// Turns the downloaded OpenStreetMap routes (scripts/osm-transit/.cache) into a
// Supabase migration that loads them into transit_lines / transit_line_points.
//
//   node scripts/osm-transit/build.ts
//
// Each run writes a NEW timestamped migration that replaces all imported lines,
// so refreshing the data is: fetch.ts --fresh, build.ts, git push.
// Data © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CACHE = join(import.meta.dirname, ".cache");
const MIGRATIONS = join(import.meta.dirname, "..", "..", "supabase", "migrations");
const SPACING_M = 200; // boarding granularity
const MOTORWAY_SPACING_M = 2000; // expressways: only for drawing
const MAX_FILE_BYTES = 1_500_000;

type Tags = Record<string, string>;
type Member = { type: "node" | "way" | "relation"; ref: number; role: string };
type Rel = { type: "relation"; id: number; tags?: Tags; members: Member[]; timestamp?: string };
type Way = { type: "way"; id: number; tags?: Tags; geometry?: { lat: number; lon: number }[] };
type Node = { type: "node"; id: number; lat: number; lon: number; tags?: Tags };
type Mode = "jeepney" | "bus" | "uv_express" | "train" | "ferry" | "tricycle";
type Pt = { lat: number; lng: number; motorway: boolean; road: string | null };

// ---------------------------------------------------------------- load cache
const rels = new Map<number, Rel>();
const ways = new Map<number, Way>();
const nodes = new Map<number, Node>();
// Prefer the complete Geofabrik extract (fetch_pbf.py) when present; otherwise use the Overpass download (fetch.ts).
const cacheFiles = readdirSync(CACHE).sort();
const pbfFiles = cacheFiles.filter((f) => f.startsWith("pbf-"));
for (const f of pbfFiles.length ? pbfFiles : cacheFiles.filter((f) => f.startsWith("batch-"))) {
  for (const e of JSON.parse(readFileSync(join(CACHE, f), "utf8")).elements as (Rel | Way | Node)[]) {
    if (e.type === "relation") rels.set(e.id, e);
    else if (e.type === "way") ways.set(e.id, e);
    else nodes.set(e.id, e);
  }
}

// ---------------------------------------------------------------- helpers
const R = 6371000;
function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function modeOf(t: Tags): Mode | null {
  const name = `${t.name ?? ""} ${t.ref ?? ""} ${t.network ?? ""}`.toLowerCase();
  switch (t.route) {
    case "train":
    case "subway":
    case "light_rail":
    case "monorail":
    case "tram":
      return "train";
    case "ferry":
      return "ferry";
    case "share_taxi":
      return /\buv\b|fx|van/.test(name) ? "uv_express" : "jeepney";
    case "minibus":
      return /\buv\b|van/.test(name) ? "uv_express" : "jeepney";
    case "bus":
    case "coach":
    case "trolleybus":
      if (/\bpuj\b|jeep|e-jeep|modern jeep/.test(name)) return "jeepney";
      if (/\buv\b|uv express/.test(name)) return "uv_express";
      return "bus";
    default:
      return null;
  }
}

// Google encoded polyline (precision 5)
function encode(points: { lat: number; lng: number }[]): string {
  let out = "";
  let pLat = 0;
  let pLng = 0;
  const enc = (v: number) => {
    let x = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (x >= 0x20) {
      s += String.fromCharCode((0x20 | (x & 0x1f)) + 63);
      x >>= 5;
    }
    return s + String.fromCharCode(x + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += enc(lat - pLat) + enc(lng - pLng);
    pLat = lat;
    pLng = lng;
  }
  return out;
}

/** Chain the route's ways into one continuous line, flipping ways as needed. */
function stitch(rel: Rel): Pt[] {
  const parts = rel.members
    .filter((m) => m.type === "way" && !m.role.startsWith("platform") && m.role !== "stop")
    .map((m) => ways.get(m.ref))
    .filter((w): w is Way => Boolean(w?.geometry?.length));
  const out: Pt[] = [];
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    const hw = w.tags?.highway ?? "";
    const road = w.tags?.name ?? null;
    // No boarding on expressways. Some are tagged "trunk" in OSM, so check the name too.
    const motorway =
      hw === "motorway" || hw === "motorway_link" || w.tags?.toll === "yes" ||
      /expressway|skyway|tollway|\b(nlex|slex|tplex|sctex|calax|cavitex|star tollway)\b/i.test(road ?? "");
    let g = w.geometry!.map((p) => ({ lat: p.lat, lng: p.lon, motorway, road }));
    if (out.length) {
      const end = out[out.length - 1];
      if (dist(end, g[g.length - 1]) < dist(end, g[0])) g = g.reverse();
      if (dist(end, g[0]) < 1) g = g.slice(1);
    } else if (parts.length > 1) {
      // Orient the first way so that it leads into the second.
      const next = parts[1].geometry!.map((p) => ({ lat: p.lat, lng: p.lon }));
      const a = g[0];
      const b = g[g.length - 1];
      const dA = Math.min(dist(a, next[0]), dist(a, next[next.length - 1]));
      const dB = Math.min(dist(b, next[0]), dist(b, next[next.length - 1]));
      if (dA < dB) g = g.reverse();
    }
    out.push(...g);
  }
  return out;
}

/** Resample to roughly even spacing; expressway stretches get sparse points (no boarding there). */
function resample(line: Pt[]): Pt[] {
  if (line.length < 2) return line;
  const out: Pt[] = [line[0]];
  let since = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const d = dist(a, b);
    if (d > 3000) {
      // gap in the mapping: keep both ends, no interpolation across it
      out.push(b);
      since = 0;
      continue;
    }
    const step = b.motorway ? MOTORWAY_SPACING_M : SPACING_M;
    let travelled = 0;
    while (since + (d - travelled) >= step) {
      travelled += step - since;
      const f = travelled / d;
      out.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, motorway: b.motorway, road: b.road });
      since = 0;
    }
    since += d - travelled;
  }
  const last = line[line.length - 1];
  if (dist(out[out.length - 1], last) > 30) out.push(last);
  return out;
}

function runs<T>(values: T[]): [number, T][] {
  const out: [number, T][] = [];
  values.forEach((v, i) => {
    if (!out.length || out[out.length - 1][1] !== v) out.push([i, v]);
  });
  return out;
}

const q = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? "null" : `'${v.replace(/'/g, "''")}'`);
const qj = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

// ---------------------------------------------------------------- build
const statements: string[] = [];
const stats = { total: rels.size, kept: 0, points: 0, skipped: {} as Record<string, number> };
const skip = (why: string) => (stats.skipped[why] = (stats.skipped[why] ?? 0) + 1);

for (const rel of [...rels.values()].sort((a, b) => a.id - b.id)) {
  const t = rel.tags ?? {};
  const mode = modeOf(t);
  if (!mode) {
    skip("unsupported type");
    continue;
  }
  const name = (t.name || [t.ref, t.from && t.to ? `${t.from}–${t.to}` : ""].filter(Boolean).join(" ")).trim();
  if (!name) {
    skip("no name");
    continue;
  }
  const raw = stitch(rel);
  let length = 0;
  for (let i = 1; i < raw.length; i++) length += dist(raw[i - 1], raw[i]);
  if (raw.length < 2 || length < 500) {
    skip("no geometry");
    continue;
  }
  if (length > 1_500_000) {
    skip("implausible length");
    continue;
  }
  const pts = resample(raw);
  const stopsOnly = mode === "train" || mode === "ferry";

  // Snap mapped stops onto the line, in order.
  const stopAt = new Map<number, string>();
  let cursor = 0;
  for (const m of rel.members.filter((m) => m.type === "node" && /^(stop|platform)/.test(m.role))) {
    const n = nodes.get(m.ref);
    if (!n) continue;
    const label = n.tags?.name ?? n.tags?.["name:en"] ?? null;
    let best = -1;
    let bestD = 250;
    for (let i = cursor; i < pts.length; i++) {
      const d = dist(pts[i], { lat: n.lat, lng: n.lon });
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      if (label && !stopAt.has(best)) stopAt.set(best, label);
      else if (!stopAt.has(best)) stopAt.set(best, "");
      cursor = best;
    }
  }
  if (stopsOnly && stopAt.size < 2) {
    skip("rail/ferry without stations");
    continue;
  }
  const boardable = pts.map((p, i) => (stopsOnly ? stopAt.has(i) : !p.motorway || stopAt.has(i)));
  const lower = `${name} ${t.network ?? ""}`.toLowerCase();
  const modern = t.air_conditioning === "yes" || /modern|e-?jeep|\bpuj\b|p2p|premium/.test(lower);
  const provincial = mode === "bus" && length > 60_000;
  const fare = [t.charge, t.fee].find((v) => v && /\d/.test(v)) ?? null;

  statements.push(
    `select private.load_transit_line(${rel.id}, '${mode}', ${q(name)}, ${q(t.ref)}, ${q(t.operator)}, ${q(t.network)}, ${q(t.from)}, ${q(t.to)}, ${q(fare)}, ${modern}, ${provincial}, ${stopsOnly}, ${q(rel.timestamp)}, ${q(encode(pts))}, ${qj(runs(boardable))}, ${qj(runs(pts.map((p) => p.road)).filter(([, r]) => r !== null || true))}, ${qj([...stopAt].filter(([, v]) => v).map(([i, v]) => [i, v]))});`,
  );
  stats.kept++;
  stats.points += pts.length;
}

// ---------------------------------------------------------------- write migrations
// Migrations run in filename order, so always sort after the newest existing one.
const latest = readdirSync(MIGRATIONS).filter((f) => /^\d{14}_/.test(f)).sort().pop()?.slice(0, 12) ?? "000000000000";
const now = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const stamp = now > latest ? now : String(BigInt(latest) + 1n).padStart(12, "0");
const header = (part: number, parts: number) => `-- =============================================================================
-- Sakay: public transit lines imported from OpenStreetMap (part ${part} of ${parts})
-- Generated by scripts/osm-transit/build.ts on ${new Date().toISOString()}.
-- ${stats.kept} lines, ${stats.points} points. Do not edit by hand: re-run the
-- importer to refresh (it writes a new migration that replaces these lines).
-- Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)
-- =============================================================================
`;
const files: string[][] = [[]];
let size = 0;
for (const st of statements) {
  if (size + st.length > MAX_FILE_BYTES && files[files.length - 1].length) {
    files.push([]);
    size = 0;
  }
  files[files.length - 1].push(st);
  size += st.length + 1;
}
files.forEach((chunk, i) => {
  const body = (i === 0 ? "delete from public.transit_lines;\n\n" : "") + chunk.join("\n") + "\n";
  const file = join(MIGRATIONS, `${stamp}${String(i + 1).padStart(2, "0")}_osm_transit_import_${String(i + 1).padStart(2, "0")}.sql`);
  writeFileSync(file, header(i + 1, files.length) + "\n" + body);
  console.log(`wrote ${file} (${(Buffer.byteLength(body) / 1e6).toFixed(2)} MB)`);
});
console.log(JSON.stringify(stats, null, 2));
