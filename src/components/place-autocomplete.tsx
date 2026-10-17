"use client";

import { Building2, Church, GraduationCap, Landmark, MapPin, ShoppingBag, TrainFront, Warehouse } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cx, inputClasses } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import type { PlaceKind } from "@/lib/types";

export type PlaceOption = { id: string; name: string; kind?: PlaceKind; city?: string | null; lat?: number; lng?: number };

const KIND_ICON: Partial<Record<PlaceKind, typeof MapPin>> = {
  mall: ShoppingBag,
  school: GraduationCap,
  church: Church,
  terminal: Warehouse,
  station: TrainFront,
  government: Landmark,
  hospital: Building2,
};

/**
 * Landmark/stop picker. Typing 2+ characters searches places (malls, schools,
 * churches, terminals, stations) through the search_places RPC.
 * Submits two fields: `${name}_text` (what was typed) and `${name}_id` (picked place).
 */
export function PlaceAutocomplete({
  name,
  label,
  placeholder,
  defaultValue,
  onSelect,
  required,
  autoFocus,
  hideLabel,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: PlaceOption | null;
  onSelect?: (place: PlaceOption | null) => void;
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
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Keep in sync when the parent swaps origin/destination.
  const defaultKey = defaultValue ? `${defaultValue.id}|${defaultValue.name}` : "";
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
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error: rpcError } = await createClient().rpc("search_places", { p_query: q, p_limit: 8 });
        if (current !== requestId.current) return;
        if (rpcError) throw rpcError;
        setOptions((data ?? []) as PlaceOption[]);
        setError(null);
        setActive(0);
      } catch {
        if (current === requestId.current) setError("Couldn't load suggestions. Check your connection.");
      } finally {
        if (current === requestId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [text, picked]);

  const choose = (place: PlaceOption) => {
    setPicked(place);
    setText(place.name);
    setOpen(false);
    onSelectRef.current?.(place);
  };

  const showList = open && text.trim().length >= 2 && (options.length > 0 || loading || error);

  return (
    <div className="relative">
      <label htmlFor={id} className={cx("mb-1.5 block text-sm font-medium text-slate-800", hideLabel && "sr-only")}>
        {label}
      </label>
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
            choose(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <input type="hidden" name={`${name}_id`} value={picked?.id ?? ""} />
      {showList ? (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {loading && !options.length ? <li className="px-3 py-2 text-sm text-slate-500">Searching…</li> : null}
          {error ? <li className="px-3 py-2 text-sm text-rose-700">{error}</li> : null}
          {options.map((o, i) => {
            const Icon = (o.kind && KIND_ICON[o.kind]) || MapPin;
            return (
              <li
                key={o.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={cx("flex cursor-pointer items-center gap-2 px-3 py-2 text-sm", i === active ? "bg-brand-50" : "")}
              >
                <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-slate-900">{o.name}</span>
                {o.city ? <span className="shrink-0 text-xs text-slate-500">{o.city}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
