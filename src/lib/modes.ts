import type { PlaceKind, TransportMode } from "@/lib/types";

export const MODES: TransportMode[] = ["jeepney", "bus", "uv_express", "tricycle", "train", "ferry", "walk"];

/** Colours used for chips and map lines (kept in one place so map and UI match). */
export const MODE_STYLE: Record<TransportMode, { hex: string; chip: string; dash?: string }> = {
  jeepney: { hex: "#d97706", chip: "bg-amber-100 text-amber-900 ring-amber-300" },
  bus: { hex: "#2563eb", chip: "bg-blue-100 text-blue-900 ring-blue-300" },
  uv_express: { hex: "#7c3aed", chip: "bg-violet-100 text-violet-900 ring-violet-300" },
  tricycle: { hex: "#059669", chip: "bg-emerald-100 text-emerald-900 ring-emerald-300" },
  train: { hex: "#e11d48", chip: "bg-rose-100 text-rose-900 ring-rose-300" },
  ferry: { hex: "#0891b2", chip: "bg-cyan-100 text-cyan-900 ring-cyan-300" },
  walk: { hex: "#64748b", chip: "bg-slate-100 text-slate-700 ring-slate-300", dash: "6 8" },
};

export const PLACE_KINDS: PlaceKind[] = ["landmark", "mall", "school", "church", "terminal", "station", "hospital", "government", "market", "other"];

export const PLACE_KIND_LABEL: Record<PlaceKind, string> = {
  landmark: "Landmark",
  mall: "Mall",
  school: "School",
  church: "Church",
  terminal: "Terminal",
  station: "Station",
  hospital: "Hospital",
  government: "Government",
  market: "Market",
  other: "Other",
};

export const REPORT_REASON_LABEL: Record<string, string> = {
  fare_changed: "Fare changed",
  rerouted: "Vehicle was rerouted",
  terminal_closed: "Terminal/stop closed or moved",
  schedule_changed: "Schedule or hours changed",
  wrong_info: "Wrong information",
  spam: "Spam",
  offensive: "Offensive or abusive",
  duplicate: "Duplicate",
  other: "Something else",
};

export const ADVISORY_KIND_LABEL: Record<string, string> = {
  road_closure: "Road closure",
  fare_change: "Fare change",
  strike: "Transport strike",
  reroute: "Rerouting",
  weather: "Weather",
  event: "Event",
  other: "Notice",
};
