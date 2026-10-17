"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { MODE_STYLE } from "@/lib/modes";
import { fetchRoadPath, pathKey, type LatLng } from "@/lib/road-paths";
import type { PlaceRef, TransportMode } from "@/lib/types";

export type MapLeg = { mode: TransportMode; from: PlaceRef; to: PlaceRef; path?: [number, number][] | null; label?: string };

const MANILA: [number, number] = [14.5995, 120.9842];

function pin(color: string, text: string, size = 26) {
  return L.divIcon({
    className: "",
    html: `<div class="sakay-pin" style="background:${color};width:${size}px;height:${size}px">${text}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    const pts = JSON.parse(key) as [number, number][];
    if (pts.length === 1) map.setView(pts[0], 16);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 16 });
  }, [key, map]);
  return null;
}

function Tiles() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
    />
  );
}

const CACHE_KEY = "sakay:road-paths:v1";
const memory = new Map<string, LatLng[] | null>();
function readCache(key: string): LatLng[] | null | undefined {
  if (memory.has(key)) return memory.get(key);
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, LatLng[]>;
    if (all[key]) memory.set(key, all[key]);
    return all[key];
  } catch {
    return undefined;
  }
}
function writeCache(key: string, path: LatLng[]) {
  memory.set(key, path);
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, LatLng[]>;
    const keys = Object.keys(all);
    if (keys.length > 300) delete all[keys[0]]; // keep the cache small
    all[key] = path;
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    // storage full or blocked: paths are re-fetched next time
  }
}

/**
 * Road-following lines for legs that don't have a saved path. Until a path
 * arrives (or if the routing server is unreachable) the leg is drawn as a
 * faint dashed straight line, so it never looks like a real road.
 */
function useRoadPaths(legs: MapLeg[]) {
  const keys = legs.map((l) => (l.path?.length ? null : pathKey(l.mode, l.from, l.to)));
  const signature = keys.join("|");
  const [fetched, setFetched] = useState<Record<string, LatLng[] | null>>({});

  useEffect(() => {
    const controller = new AbortController();
    const wanted = signature.split("|").map((k, i) => ({ k, i })).filter((x) => x.k);
    (async () => {
      for (const { k, i } of wanted) {
        const cached = readCache(k);
        if (cached !== undefined) {
          setFetched((f) => (k in f ? f : { ...f, [k]: cached }));
          continue;
        }
        const leg = legs[i];
        const path = await fetchRoadPath(leg.mode, leg.from, leg.to, controller.signal);
        if (controller.signal.aborted) return;
        if (path) writeCache(k, path);
        else memory.set(k, null);
        setFetched((f) => ({ ...f, [k]: path }));
      }
    })();
    return () => controller.abort();
    // legs are described completely by `signature`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return legs.map((l, i) => {
    if (l.path?.length) return { points: l.path as LatLng[], exact: true };
    const road = keys[i] ? fetched[keys[i]!] : null;
    return road ? { points: road, exact: true } : { points: [[l.from.lat, l.from.lng], [l.to.lat, l.to.lng]] as LatLng[], exact: false };
  });
}

/** Draws a trip: one coloured line per leg, A = pickup, B = drop-off, numbers = transfers. */
export function RouteMapInner({ legs, className, single }: { legs: MapLeg[]; className?: string; single?: PlaceRef }) {
  const lines = useRoadPaths(legs);
  // Fit to the stops (not the road shapes) so the view doesn't jump while paths load.
  const points = useMemo(() => {
    if (single) return [[single.lat, single.lng] as [number, number]];
    return legs.flatMap((l) => [[l.from.lat, l.from.lng], [l.to.lat, l.to.lng]] as [number, number][]);
  }, [legs, single]);

  // Number only the places where you board a different vehicle; walking legs don't count.
  const transfers: { place: PlaceRef; n: number }[] = [];
  let rides = 0;
  legs.forEach((l) => {
    if (l.mode === "walk") return;
    if (rides > 0) transfers.push({ place: l.from, n: transfers.length + 1 });
    rides++;
  });

  return (
    <MapContainer center={points[0] ?? MANILA} zoom={13} scrollWheelZoom={false} className={className} style={{ height: "100%", width: "100%" }}>
      <Tiles />
      <FitBounds points={points} />
      {legs.map((leg, i) => {
        const style = MODE_STYLE[leg.mode];
        const { points: line, exact } = lines[i];
        return (
          <Polyline
            key={`${i}-${exact}`}
            positions={line}
            pathOptions={{
              color: style.hex,
              weight: leg.mode === "walk" ? 4 : 6,
              opacity: exact ? 0.9 : 0.35,
              dashArray: exact ? style.dash : "4 10",
            }}
          >
            <Tooltip sticky>{leg.label ?? leg.mode}</Tooltip>
          </Polyline>
        );
      })}
      {legs.length > 0 ? (
        <Marker position={[legs[0].from.lat, legs[0].from.lng]} icon={pin("#059669", "A", 30)}>
          <Popup>Pickup: {legs[0].from.name}</Popup>
        </Marker>
      ) : null}
      {transfers.map((t) => (
        <Marker key={`${t.place.id}-${t.n}`} position={[t.place.lat, t.place.lng]} icon={pin("#d97706", String(t.n), 24)}>
          <Popup>Transfer {t.n}: {t.place.name}</Popup>
        </Marker>
      ))}
      {legs.length > 0 ? (
        <Marker position={[legs[legs.length - 1].to.lat, legs[legs.length - 1].to.lng]} icon={pin("#e11d48", "B", 30)}>
          <Popup>Drop-off: {legs[legs.length - 1].to.name}</Popup>
        </Marker>
      ) : null}
      {single ? (
        <Marker position={[single.lat, single.lng]} icon={pin("#1d4ed8", "●", 26)}>
          <Popup>{single.name}</Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

/** Tap the map to drop a pin (used when adding a new place). */
export function PlacePickerInner({ value, onChange, className }: { value: { lat: number; lng: number } | null; onChange: (lat: number, lng: number) => void; className?: string }) {
  return (
    <MapContainer center={value ? [value.lat, value.lng] : MANILA} zoom={value ? 16 : 12} className={className} style={{ height: "100%", width: "100%" }}>
      <Tiles />
      <ClickToPick onPick={onChange} />
      {value ? <Marker position={[value.lat, value.lng]} icon={pin("#1d4ed8", "●", 26)} /> : null}
    </MapContainer>
  );
}
