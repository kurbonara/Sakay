"use client";

import dynamic from "next/dynamic";
import { Skeleton, cx } from "@/components/ui/primitives";

// Leaflet touches `window`, so it only loads in the browser.
export const RouteMap = dynamic(() => import("./leaflet-map").then((m) => m.RouteMapInner), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export const PlacePicker = dynamic(() => import("./leaflet-map").then((m) => m.PlacePickerInner), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export function MapFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("relative isolate overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200", className)}>{children}</div>;
}
