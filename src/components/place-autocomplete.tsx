"use client";

import { Building2, Church, GraduationCap, Landmark, Loader2, MapPin, ShoppingBag, TrainFront, Warehouse } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cx, inputClasses } from "@/components/ui/primitives";
import { geocode } from "@/lib/geocode";
import { createClient } from "@/lib/supabase/client";
import type { PlaceKind } from "@/lib/types";

export type PlaceOption = {
  /** Sakay place id; empty for a place that only exists on the map (OpenStreetMap). */
  id: string;
  name: string;
  kind?: PlaceKind;
  city?: string | null;
  lat?: number;
  lng?: number;
  source?: "sakay" | "map";
  subtitle?: string | null;
};

const KIND_ICON: Partial<Record<PlaceKind, typeof MapPin>> = {
  mall: ShoppingBag,
  school: GraduationCap,
  church: Church,
  terminal: Warehouse,
  station: TrainFront,
  government: Landmark,
  hospital: Building2,
};

const near = (a: PlaceOption, b: PlaceOption) =>
  a.lat != null && b.lat != null && Math.abs(a.lat - b.lat!) < 0.0015 && Math.abs((a.lng ?? 0) - (b.lng ?? 0)) < 0.0015;

/**
 * Place picker. Shows Sakay's own places first (stops, terminals, landmarks
 * with routes), then any other place in the Philippines from OpenStreetMap.
 * Submits `${name}_text`, `${name}_id` (Sakay places only) and
 * `${name}_lat` / `${name}_lng` (any picked place).
 *
 * `onPickMap` lets a form turn a map place into a Sakay place first
 * (used when submitting routes, which need real stops).
 */
export function PlaceAutocomplete({
  name,
  label,
  placeholder,
  defaultValue,
  onSelect,
  onPickMap,
  required,
  autoFocus,
  hideLabel,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: PlaceOption | null;
  onSelect?: (place: PlaceOption | null) => void;
  onPickMap?: (place: PlaceOption) => Promise<PlaceOption | { error: string }>;
  required?: boolean;
  autoFocus?: boolean;
  hideLabel?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(defaultValue?.name ?? "");
  const [picked, setPicked] = useState<PlaceOption | null>(defaultValue ?? null);
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyFor, setEmptyFor] = useState<string | null>(null);
  const requestId = useRef(0);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Keep in sync when the parent swaps origin/destination.
  const defaultKey = defaultValue ? `${defaultValue.id}|${defaultValue.name}|${defaultValue.lat ?? ""}` : "";
  const [lastDefault, setLastDefault] = useState(defaultKey);
  if (defaultKey !== lastDefault) {
    setLastDefault(defaultKey);
    setText(defaultValue?.name ?? "");
    setPicked(defaultValue ?? null);
  }

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || (picked && picked.name === text)) return;
    const current = ++requestId.current;
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      // 1) Sakay's own places (fast).
      let own: PlaceOption[] = [];
      try {
        const { data, error: rpcError } = await createClient().rpc("search_places", { p_query: q, p_limit: 6 });
        if (rpcError) throw rpcError;
        own = ((data ?? []) as PlaceOption[]).map((p) => ({ ...p, source: "sakay" as const }));
        if (current !== requestId.current) return;
        setOptions(own);
        setError(null);
        setActive(0);
      } catch {
        if (current === requestId.current) setError("Couldn't load Sakay places. Check your connection.");
      } finally {
        if (current === requestId.current) setLoading(false);
      }
      // 2) Everything else on the map (OpenStreetMap), for 3+ characters.
      if (q.length < 3) {
        if (current === requestId.current) setEmptyFor(own.length ? null : q);
        return;
      }
      setMapLoading(true);
      const map = await geocode(q, { limit: 6, signal: controller.signal });
      if (current !== requestId.current) return;
      const extra = map.filter((m) => !own.some((o) => near(o, m) && o.name.toLowerCase().includes(m.name.toLowerCase().slice(0, 6)))).map((m) => ({ ...m, id: m.id, source: "map" as const }));
      setOptions([...own, ...extra]);
      setEmptyFor(own.length || extra.length ? null : q);
      setMapLoading(false);
    }, 250);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [text, picked]);

  const choose = async (place: PlaceOption) => {
    setOpen(false);
    setText(place.name);
    if (place.source === "map") {
      if (onPickMap) {
        setAdding(true);
        const res = await onPickMap(place);
        setAdding(false);
        if ("error" in res) {
          setError(res.error);
          setOpen(true);
          return;
        }
        setPicked(res);
        onSelectRef.current?.(res);
        return;
      }
      const mapPlace = { ...place, id: "" };
      setPicked(mapPlace);
      onSelectRef.current?.(mapPlace);
      return;
    }
    setPicked(place);
    onSelectRef.current?.(place);
  };

  const busy = loading || mapLoading;
  const noMatch = !busy && !error && options.length === 0 && emptyFor === text.trim();
  const showList = open && text.trim().length >= 2 && (options.length > 0 || busy || error || noMatch);
  const firstMap = options.findIndex((o) => o.source === "map");

  return (
    <div className="relative">
      <label htmlFor={id} className={cx("mb-1.5 block text-sm font-medium text-slate-800", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={Boolean(showList)}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          required={required}
          name={`${name}_text`}
          value={text}
          placeholder={placeholder}
          disabled={adding}
          className={inputClasses}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (picked) {
              setPicked(null);
              onSelectRef.current?.(null);
            }
          }}
          onKeyDown={(e) => {
            if (!showList || !options.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % options.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + options.length) % options.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              void choose(options[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {adding ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" aria-label="Adding place" /> : null}
      </div>
      <input type="hidden" name={`${name}_id`} value={picked?.id ?? ""} />
      <input type="hidden" name={`${name}_lat`} value={picked?.lat ?? ""} />
      <input type="hidden" name={`${name}_lng`} value={picked?.lng ?? ""} />
      {showList ? (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {loading && !options.length ? <li className="px-3 py-2 text-sm text-slate-500">Searching…</li> : null}
          {error ? <li className="px-3 py-2 text-sm text-rose-700">{error}</li> : null}
          {noMatch ? (
            <li className="px-3 py-2 text-sm text-slate-600">
              No place called &ldquo;{text.trim()}&rdquo; found. Try a nearby mall, school, church or terminal. You can still search with what you typed.
            </li>
          ) : null}
          {options.map((o, i) => {
            const Icon = (o.kind && KIND_ICON[o.kind]) || MapPin;
            return (
              <li key={`${o.source}-${o.id}`} role="presentation">
                {i === firstMap ? (
                  <p className="border-t border-slate-100 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">More places on the map</p>
                ) : null}
                <div
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void choose(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cx("flex cursor-pointer items-center gap-2 px-3 py-2 text-sm", i === active ? "bg-brand-50" : "")}
                >
                  <Icon className={cx("size-4 shrink-0", o.source === "map" ? "text-slate-300" : "text-brand-500")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-900">{o.name}</span>
                    {o.source === "map" && o.subtitle ? <span className="block truncate text-xs text-slate-500">{o.subtitle}</span> : null}
                  </span>
                  {o.source !== "map" && o.city ? <span className="shrink-0 text-xs text-slate-500">{o.city}</span> : null}
                </div>
              </li>
            );
          })}
          {mapLoading ? <li className="px-3 py-1.5 text-xs text-slate-400">Searching the map…</li> : null}
          {options.length ? <li className="px-3 pt-1 text-[10px] text-slate-400">Map places © OpenStreetMap contributors</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
