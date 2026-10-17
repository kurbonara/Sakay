"use client";

import { ArrowDown, ArrowUp, Loader2, MapPinPlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { MapFrame, PlacePicker, RouteMap } from "@/components/map";
import { PlaceAutocomplete, type PlaceOption } from "@/components/place-autocomplete";
import { FormMessage } from "@/components/ui/client";
import { buttonClasses, Card, cx, Field, inputClasses } from "@/components/ui/primitives";
import { adminUpdateRoute } from "@/lib/actions/admin";
import { submitRoute, suggestPlace, type RouteDraft } from "@/lib/actions/community";
import { MODES, PLACE_KIND_LABEL, PLACE_KINDS } from "@/lib/modes";
import type { ActionState, PlaceKind, TransportMode } from "@/lib/types";

export type LegDraft = {
  key: string;
  mode: TransportMode;
  from: PlaceOption | null;
  to: PlaceOption | null;
  signboard: string;
  instructions: string;
  fare: string;
  fare_discounted: string;
  minutes: string;
};

export type RouteFormInitial = {
  title: string;
  summary: string;
  operating_hours: string;
  pwd_friendly: boolean;
  senior_friendly: boolean;
  heavy_load_friendly: boolean;
  accessibility_notes: string;
  legs: LegDraft[];
};

let keySeq = 0;
const newKey = () => `leg-${Date.now()}-${keySeq++}`;
export const emptyLeg = (from: PlaceOption | null = null): LegDraft => ({
  key: newKey(),
  mode: "jeepney",
  from,
  to: null,
  signboard: "",
  instructions: "",
  fare: "",
  fare_discounted: "",
  minutes: "",
});

const MODE_LABEL: Record<TransportMode, string> = { jeepney: "Jeepney", bus: "Bus", uv_express: "UV Express", tricycle: "Tricycle", train: "Train", ferry: "Ferry", walk: "Walk" };

export function RouteForm({ initial, routeId, modeLabels = MODE_LABEL }: { initial?: RouteFormInitial; routeId?: string; modeLabels?: Record<TransportMode, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [legs, setLegs] = useState<LegDraft[]>(initial?.legs?.length ? initial.legs : [emptyLeg()]);
  const formRef = useRef<HTMLFormElement>(null);

  const update = (i: number, patch: Partial<LegDraft>) =>
    setLegs((ls) => {
      const next = ls.map((l, j) => (j === i ? { ...l, ...patch } : l));
      // Keep the chain connected: the next leg starts where this one ends.
      if (patch.to !== undefined && next[i + 1] && (!next[i + 1].from || next[i + 1].from?.id === ls[i].to?.id)) {
        next[i + 1] = { ...next[i + 1], from: patch.to, key: next[i + 1].from?.id === patch.to?.id ? next[i + 1].key : newKey() };
      }
      return next;
    });

  const move = (i: number, dir: -1 | 1) =>
    setLegs((ls) => {
      const j = i + dir;
      if (j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const previewLegs = legs
    .filter((l) => l.from?.lat != null && l.to?.lat != null)
    .map((l) => ({ mode: l.mode, from: { id: l.from!.id, name: l.from!.name, lat: l.from!.lat!, lng: l.from!.lng! }, to: { id: l.to!.id, name: l.to!.name, lat: l.to!.lat!, lng: l.to!.lng! } }));

  function submit() {
    if (pending || !formRef.current) return;
    const fd = new FormData(formRef.current);
    const draft: RouteDraft = {
      title: String(fd.get("title") ?? "").trim(),
      summary: String(fd.get("summary") ?? ""),
      operating_hours: String(fd.get("operating_hours") ?? ""),
      pwd_friendly: fd.get("pwd_friendly") === "on",
      senior_friendly: fd.get("senior_friendly") === "on",
      heavy_load_friendly: fd.get("heavy_load_friendly") === "on",
      accessibility_notes: String(fd.get("accessibility_notes") ?? ""),
      legs: legs.map((l) => ({
        mode: l.mode,
        from_place_id: l.from?.id ?? "",
        to_place_id: l.to?.id ?? "",
        signboard: l.signboard,
        instructions: l.instructions,
        fare: l.mode === "walk" ? 0 : l.fare,
        fare_discounted: l.fare_discounted || null,
        minutes: l.minutes,
      })),
    };
    const missing = legs.findIndex((l) => !l.from?.id || !l.to?.id);
    if (missing >= 0) {
      setState({ ok: false, message: `Leg ${missing + 1}: pick both places from the suggestions (or add a new place).` });
      return;
    }
    startTransition(async () => {
      const res = routeId ? await adminUpdateRoute(routeId, draft) : await submitRoute(draft);
      setState(res);
      if (res?.ok) router.push(routeId ? `/routes/${routeId}` : (res.redirectTo ?? "/account"));
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <Card className="space-y-4">
        <Field label="Route title" htmlFor="title" hint='Example: "SM North EDSA to UP Diliman by jeep"'>
          <input id="title" name="title" required minLength={5} maxLength={140} defaultValue={initial?.title} className={inputClasses} />
        </Field>
        <Field label="Short description" htmlFor="summary" optional>
          <textarea id="summary" name="summary" rows={2} maxLength={1000} defaultValue={initial?.summary} className={inputClasses} placeholder="When is it best to take this? Anything to know before riding?" />
        </Field>
        <Field label="Operating hours" htmlFor="operating_hours" optional hint='Example: "5:00 AM - 10:00 PM" or "24 hours"'>
          <input id="operating_hours" name="operating_hours" maxLength={120} defaultValue={initial?.operating_hours} className={inputClasses} />
        </Field>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Legs (each ride or walk)</h2>
        {legs.map((leg, i) => (
          <LegEditor
            key={leg.key}
            index={i}
            leg={leg}
            total={legs.length}
            modeLabels={modeLabels}
            onChange={(patch) => update(i, patch)}
            onRemove={() => setLegs((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))}
            onMove={(dir) => move(i, dir)}
          />
        ))}
        <button
          type="button"
          onClick={() => setLegs((ls) => (ls.length >= 8 ? ls : [...ls, emptyLeg(ls[ls.length - 1]?.to ?? null)]))}
          disabled={legs.length >= 8}
          className={buttonClasses("secondary", "md")}
        >
          <Plus className="size-4" aria-hidden /> Add another leg (transfer)
        </button>
      </div>

      {previewLegs.length ? (
        <MapFrame className="h-64 sm:h-80">
          <RouteMap legs={previewLegs} />
        </MapFrame>
      ) : null}

      <Card className="space-y-3">
        <h2 className="font-bold text-slate-900">Accessibility</h2>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="pwd_friendly" defaultChecked={initial?.pwd_friendly} className="size-4 accent-brand-600" /> PWD-friendly
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="senior_friendly" defaultChecked={initial?.senior_friendly} className="size-4 accent-brand-600" /> Senior-friendly
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="heavy_load_friendly" defaultChecked={initial?.heavy_load_friendly} className="size-4 accent-brand-600" /> OK with heavy bags
          </label>
        </div>
        <textarea
          name="accessibility_notes"
          rows={2}
          maxLength={500}
          defaultValue={initial?.accessibility_notes}
          className={inputClasses}
          placeholder="Ramps, elevators, stairs, high steps, space for luggage…"
          aria-label="Accessibility notes"
        />
      </Card>

      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {routeId ? "Save changes" : "Submit for review"}
        </button>
        {!routeId ? <p className="text-sm text-slate-500">A moderator checks new routes before they appear in search.</p> : null}
      </div>
    </form>
  );
}

function LegEditor({
  index,
  leg,
  total,
  modeLabels,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  leg: LegDraft;
  total: number;
  modeLabels: Record<TransportMode, string>;
  onChange: (patch: Partial<LegDraft>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const walk = leg.mode === "walk";
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">Leg {index + 1}</p>
        <div className="flex gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={buttonClasses("ghost", "sm")} aria-label="Move up">
            <ArrowUp className="size-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className={buttonClasses("ghost", "sm")} aria-label="Move down">
            <ArrowDown className="size-4" />
          </button>
          <button type="button" onClick={onRemove} disabled={total === 1} className={buttonClasses("ghost", "sm", "text-rose-700")} aria-label="Remove leg">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Vehicle type">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={leg.mode === m}
            onClick={() => leg.mode !== m && onChange({ mode: m })}
            className={cx(
              "rounded-full px-3 py-1.5 text-sm font-medium ring-1",
              leg.mode === m ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {modeLabels[m]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <PlaceAutocomplete name={`leg${index}_from`} label="Pickup point (from)" placeholder="Landmark, stop or terminal" defaultValue={leg.from} onSelect={(p) => onChange({ from: p })} />
          <NewPlaceButton onCreated={(p) => onChange({ from: p })} />
        </div>
        <div>
          <PlaceAutocomplete name={`leg${index}_to`} label="Drop-off point (to)" placeholder="Where you get off" defaultValue={leg.to} onSelect={(p) => onChange({ to: p })} />
          <NewPlaceButton onCreated={(p) => onChange({ to: p })} />
        </div>
      </div>
      {!walk ? (
        <Field label="Signboard (what the vehicle says)" htmlFor={`sign-${leg.key}`} optional>
          <input id={`sign-${leg.key}`} value={leg.signboard} maxLength={120} onChange={(e) => onChange({ signboard: e.target.value })} className={cx(inputClasses, "font-mono uppercase")} placeholder="e.g. UP CAMPUS / SM NORTH" />
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {!walk ? (
          <>
            <Field label="Fare (₱)" htmlFor={`fare-${leg.key}`}>
              <input id={`fare-${leg.key}`} type="number" inputMode="decimal" min={0} max={5000} step="0.25" value={leg.fare} onChange={(e) => onChange({ fare: e.target.value })} className={inputClasses} required />
            </Field>
            <Field label="Discounted (₱)" htmlFor={`fared-${leg.key}`} optional hint="Blank = 20% off">
              <input id={`fared-${leg.key}`} type="number" inputMode="decimal" min={0} max={5000} step="0.25" value={leg.fare_discounted} onChange={(e) => onChange({ fare_discounted: e.target.value })} className={inputClasses} />
            </Field>
          </>
        ) : null}
        <Field label="Minutes" htmlFor={`min-${leg.key}`}>
          <input id={`min-${leg.key}`} type="number" inputMode="numeric" min={1} max={600} value={leg.minutes} onChange={(e) => onChange({ minutes: e.target.value })} className={inputClasses} required />
        </Field>
      </div>
      <Field label="Directions for this leg" htmlFor={`how-${leg.key}`} optional>
        <textarea id={`how-${leg.key}`} rows={2} maxLength={600} value={leg.instructions} onChange={(e) => onChange({ instructions: e.target.value })} className={inputClasses} placeholder="Where exactly to wait, which side of the road, where to get off…" />
      </Field>
    </Card>
  );
}

function NewPlaceButton({ onCreated }: { onCreated: (p: PlaceOption) => void }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PlaceKind>("landmark");
  const [city, setCity] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
        <MapPinPlus className="size-3.5" aria-hidden /> Can&apos;t find it? Add a new place
      </button>
    );
  }
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name, e.g. Puregold Philcoa" maxLength={120} className={inputClasses} aria-label="New place name" />
      <div className="grid grid-cols-2 gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as PlaceKind)} className={inputClasses} aria-label="Kind of place">
          {PLACE_KINDS.map((k) => (
            <option key={k} value={k}>
              {PLACE_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" maxLength={60} className={inputClasses} aria-label="City" />
      </div>
      <p className="text-xs text-slate-600">Tap the map where the place is:</p>
      <MapFrame className="h-48">
        <PlacePicker value={pin} onChange={(lat, lng) => setPin({ lat, lng })} />
      </MapFrame>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className={buttonClasses("primary", "sm")}
          onClick={() => {
            if (name.trim().length < 2) return setError("Give the place a name.");
            if (!pin) return setError("Tap the map to drop a pin.");
            startTransition(async () => {
              const res = await suggestPlace({ name: name.trim(), kind, lat: pin.lat, lng: pin.lng, city: city.trim() || undefined });
              if (!res.ok) return setError(res.message);
              onCreated({ id: res.id, name: name.trim(), kind, lat: pin.lat, lng: pin.lng, city });
              setOpen(false);
            });
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Add place
        </button>
        <button type="button" className={buttonClasses("ghost", "sm")} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
