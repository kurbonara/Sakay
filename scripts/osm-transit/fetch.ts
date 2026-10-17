// Downloads every public-transport route in the Philippines from OpenStreetMap
// (via the Overpass API) into scripts/osm-transit/.cache/. Safe to re-run: it
// skips batches that are already cached unless you pass --fresh.
//
//   node scripts/osm-transit/fetch.ts [--fresh]
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CACHE = join(import.meta.dirname, ".cache");
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const PH_BBOX = "4.5,116.9,21.2,126.6";
const ROUTE_TYPES = "share_taxi|bus|minibus|coach|train|subway|light_rail|monorail|tram|ferry|trolleybus";
const BATCH = 25;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(query: string, prefer = 0): Promise<{ elements: unknown[] }> {
  let lastError = "";
  const order = [...ENDPOINTS.slice(prefer % ENDPOINTS.length), ...ENDPOINTS.slice(0, prefer % ENDPOINTS.length)];
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const ep of order) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Sakay/1.0 (community commute app; transit import)", accept: "application/json" },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(300_000),
        });
        const text = await res.text();
        if (res.ok && text.trimStart().startsWith("{")) return JSON.parse(text);
        lastError = `${ep} → HTTP ${res.status}`;
      } catch (e) {
        lastError = `${ep} → ${(e as Error).message}`;
      }
      await sleep(4000);
    }
    await sleep(15000 * (attempt + 1));
  }
  throw new Error(`Overpass failed: ${lastError}`);
}

if (process.argv.includes("--fresh")) rmSync(CACHE, { recursive: true, force: true });
mkdirSync(CACHE, { recursive: true });

const listFile = join(CACHE, "relations.json");
if (!existsSync(listFile)) {
  console.log("Listing transit routes in the Philippines…");
  const list = await overpass(`[out:json][timeout:300];relation["type"="route"]["route"~"^(${ROUTE_TYPES})$"](${PH_BBOX});out ids;`);
  writeFileSync(listFile, JSON.stringify(list));
}
const ids = (JSON.parse(readFileSync(listFile, "utf8")).elements as { id: number }[]).map((e) => e.id).sort((a, b) => a - b);
console.log(`${ids.length} routes. Downloading geometry in batches of ${BATCH}…`);

const batches: number[] = [];
for (let i = 0; i < ids.length; i += BATCH) batches.push(i);
let done = 0;
const failed: number[] = [];
const query = (chunk: number[]) => `[out:json][timeout:300];relation(id:${chunk.join(",")})->.r;.r out body;way(r.r);out tags geom;node(r.r);out;`;
// A few workers in parallel, each starting on a different Overpass mirror.
async function worker(n: number) {
  while (batches.length) {
    const i = batches.shift()!;
    const file = join(CACHE, `batch-${String(i / BATCH).padStart(4, "0")}.json`);
    if (!existsSync(file)) {
      const chunk = ids.slice(i, i + BATCH);
      try {
        writeFileSync(file, JSON.stringify(await overpass(query(chunk), n)));
      } catch {
        // Too heavy for the server (very long routes): fetch one route at a time instead.
        const merged: unknown[] = [];
        for (const id of chunk) {
          try {
            merged.push(...(await overpass(query([id]), n + 1)).elements);
          } catch (e) {
            failed.push(id);
            console.log(`  skipped relation ${id}: ${(e as Error).message}`);
          }
        }
        writeFileSync(file, JSON.stringify({ elements: merged }));
      }
      await sleep(1000);
    }
    done++;
    if (done % 4 === 0) console.log(`  ${Math.min(done * BATCH, ids.length)}/${ids.length}`);
  }
}
await Promise.all([0, 1, 2, 3].map(worker));
// Retry routes that failed before (this run or an earlier one), one at a time.
const failedFile = join(CACHE, "failed.json");
const retry = [...new Set([...(existsSync(failedFile) ? (JSON.parse(readFileSync(failedFile, "utf8")) as number[]) : []), ...failed])];
failed.length = 0;
for (const id of retry) {
  try {
    writeFileSync(join(CACHE, `batch-retry-${id}.json`), JSON.stringify(await overpass(query([id]), id)));
    await sleep(1500);
  } catch {
    failed.push(id);
  }
}
writeFileSync(failedFile, JSON.stringify(failed));
if (failed.length) console.log(`${failed.length} routes still could not be downloaded; run this command again later to retry them.`);
console.log("Done. Now run: node scripts/osm-transit/build.ts");
