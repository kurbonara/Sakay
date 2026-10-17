"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { MODE_STYLE } from "@/lib/modes";
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

/** Draws a trip: one coloured line per leg, A = pickup, B = drop-off, numbers = transfers. */
export function RouteMapInner({ legs, className, single }: { legs: MapLeg[]; className?: string; single?: PlaceRef }) {
  const points = useMemo(() => {
    if (single) return [[single.lat, single.lng] as [number, number]];
    return legs.flatMap((l) => (l.path?.length ? l.path : [[l.from.lat, l.from.lng], [l.to.lat, l.to.lng]]) as [number, number][]);
  }, [legs, single]);

  const transfers = legs.slice(1).map((l, i) => ({ place: l.from, n: i + 1 }));

  return (
    <MapContainer center={points[0] ?? MANILA} zoom={13} scrollWheelZoom={false} className={className} style={{ height: "100%", width: "100%" }}>
      <Tiles />
      <FitBounds points={points} />
      {legs.map((leg, i) => {
        const style = MODE_STYLE[leg.mode];
        const line = (leg.path?.length ? leg.path : [[leg.from.lat, leg.from.lng], [leg.to.lat, leg.to.lng]]) as [number, number][];
        return (
          <Polyline key={i} positions={line} pathOptions={{ color: style.hex, weight: leg.mode === "walk" ? 4 : 6, opacity: 0.9, dashArray: style.dash }}>
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
