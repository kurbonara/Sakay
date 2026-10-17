"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cx } from "@/components/ui/primitives";
import { TIME_ZONE } from "@/lib/env";
import { formatClock } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

function minutesNowInZone(): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute") + get("second") / 60;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function openStatus(open: string | null, close: string | null, now: number) {
  if (!open || !close) return { known: false as const };
  const o = toMin(open);
  const c = toMin(close);
  if (o === c) return { known: true as const, open: true, always: true, nextChangeIn: Infinity };
  const isOpen = o < c ? now >= o && now < c : now >= o || now < c; // handles past-midnight hours
  const target = isOpen ? c : o;
  const nextChangeIn = ((target - now + 1440) % 1440) || 1440;
  return { known: true as const, open: isOpen, always: false, nextChangeIn };
}

const subscribe = () => () => {};

/** "Open now / Closed" badge that flips exactly at opening/closing time (Asia/Manila). */
export function OpenNow({ open, close, note }: { open: string | null; close: string | null; note?: string | null }) {
  const t = useT();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const [tick, setTick] = useState(0);
  const now = hydrated ? minutesNowInZone() : 0;
  const status = openStatus(open, close, now);

  useEffect(() => {
    if (!hydrated || !status.known || status.always) return;
    const ms = Math.max(1000, status.nextChangeIn * 60_000 + 500);
    const id = setTimeout(() => setTick((x) => x + 1), Math.min(ms, 2_147_000_000));
    return () => clearTimeout(id);
  }, [hydrated, status.known, status.always, status.nextChangeIn, tick]);

  if (!status.known) return <span className="text-xs text-slate-500">{note || t("terminals.hoursUnknown")}</span>;
  if (!hydrated) return <span className="text-xs text-slate-500">{formatClock(open)} – {formatClock(close)}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1", status.open ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200")}>
        <span className={cx("size-1.5 rounded-full", status.open ? "bg-emerald-500" : "bg-slate-400")} aria-hidden />
        {status.always ? t("terminals.open24") : status.open ? t("terminals.openNow") : t("terminals.closed")}
      </span>
      {!status.always ? (
        <span className="text-slate-500">{status.open ? t("terminals.closesAt", { time: formatClock(close) }) : t("terminals.opensAt", { time: formatClock(open) })}</span>
      ) : null}
    </span>
  );
}
