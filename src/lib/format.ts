import { TIME_ZONE } from "@/lib/env";

export function peso(amount: number | string | null | undefined, lang: "en" | "fil" = "en"): string {
  const n = Number(amount ?? 0);
  if (n === 0) return lang === "fil" ? "Libre" : "Free";
  return `₱${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

export function duration(minutes: number, lang: "en" | "fil" = "en"): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hr = lang === "fil" ? "oras" : "hr";
  return rest ? `${h} ${hr} ${rest} min` : `${h} ${hr}`;
}

export function formatDateTime(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...opts,
  }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-PH", { timeZone: TIME_ZONE, month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

/** "5 minutes ago" style. Only call at request time (inside dynamic components). */
export function timeAgo(iso: string | null | undefined, now: number, lang: "en" | "fil" = "en"): string {
  if (!iso) return "";
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang === "fil" ? "fil" : "en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(-diff, "second");
  if (abs < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(-Math.round(diff / 86400), "day");
  return formatDate(iso);
}

/** "HH:MM:SS" (Postgres time) -> "5:00 AM". */
export function formatClock(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Convert an ISO timestamp to the value a <input type="datetime-local"> expects, in TIME_ZONE. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Interpret a datetime-local value as wall-clock time in TIME_ZONE and return ISO (UTC). */
export function fromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const [date, time] = value.split("T");
  if (!date || !time) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Find the zone offset at that instant and correct for it.
  const asZone = new Date(new Date(guess).toLocaleString("en-US", { timeZone: TIME_ZONE }));
  const asUtc = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = asZone.getTime() - asUtc.getTime();
  return new Date(guess - offset).toISOString();
}

export function initials(name: string | null | undefined): string {
  return (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
