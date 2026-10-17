"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { MapFrame, PlacePicker } from "@/components/map";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { Field, inputClasses } from "@/components/ui/primitives";
import { upsertPlace } from "@/lib/actions/admin";
import { MODES, PLACE_KIND_LABEL, PLACE_KINDS } from "@/lib/modes";
import type { ActionState, Place } from "@/lib/types";

export function PlaceForm({ place }: { place: Place | null }) {
  const [state, action] = useActionState<ActionState, FormData>(upsertPlace, null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(place ? { lat: place.lat, lng: place.lng } : null);
  return (
    <form action={action} className="space-y-4" key={place?.id ?? "new"}>
      <input type="hidden" name="id" value={place?.id ?? ""} />
      <Field label="Name" htmlFor="p-name">
        <input id="p-name" name="name" required minLength={2} maxLength={120} defaultValue={place?.name} className={inputClasses} />
      </Field>
      <Field label="Also known as" htmlFor="p-aliases" optional hint="Comma-separated, e.g. MOA, Mall of Asia">
        <input id="p-aliases" name="aliases" defaultValue={place?.aliases.join(", ")} className={inputClasses} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind" htmlFor="p-kind">
          <select id="p-kind" name="kind" defaultValue={place?.kind ?? "landmark"} className={inputClasses}>
            {PLACE_KINDS.map((k) => (
              <option key={k} value={k}>
                {PLACE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City" htmlFor="p-city" optional>
          <input id="p-city" name="city" maxLength={60} defaultValue={place?.city ?? ""} className={inputClasses} />
        </Field>
      </div>
      <Field label="Address" htmlFor="p-address" optional>
        <input id="p-address" name="address" maxLength={200} defaultValue={place?.address ?? ""} className={inputClasses} />
      </Field>
      <Field label="Location" hint="Tap the map to move the pin.">
        <MapFrame className="h-56">
          <PlacePicker value={pin} onChange={(lat, lng) => setPin({ lat, lng })} />
        </MapFrame>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input name="lat" type="number" step="any" required value={pin?.lat ?? ""} onChange={(e) => setPin((p) => ({ lat: Number(e.target.value), lng: p?.lng ?? 121 }))} className={inputClasses} aria-label="Latitude" placeholder="Latitude" />
          <input name="lng" type="number" step="any" required value={pin?.lng ?? ""} onChange={(e) => setPin((p) => ({ lat: p?.lat ?? 14.6, lng: Number(e.target.value) }))} className={inputClasses} aria-label="Longitude" placeholder="Longitude" />
        </div>
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-800">Vehicles that load here</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {MODES.filter((m) => m !== "walk").map((m) => (
            <label key={m} className="inline-flex items-center gap-1.5">
              <input type="checkbox" name="modes" value={m} defaultChecked={place?.modes.includes(m)} className="size-4 accent-brand-600" /> {m.replace("_", " ")}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Opens" htmlFor="p-open" optional>
          <input id="p-open" name="hours_open" type="time" defaultValue={place?.hours_open?.slice(0, 5) ?? ""} className={inputClasses} />
        </Field>
        <Field label="Closes" htmlFor="p-close" optional hint="Same as opening = 24 hours">
          <input id="p-close" name="hours_close" type="time" defaultValue={place?.hours_close?.slice(0, 5) ?? ""} className={inputClasses} />
        </Field>
      </div>
      <Field label="Hours note" htmlFor="p-note" optional>
        <input id="p-note" name="hours_note" maxLength={120} defaultValue={place?.hours_note ?? ""} placeholder="e.g. Fewer trips after 9 PM" className={inputClasses} />
      </Field>
      <Field label="Description" htmlFor="p-desc" optional>
        <textarea id="p-desc" name="description" rows={2} maxLength={500} defaultValue={place?.description ?? ""} className={inputClasses} />
      </Field>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_verified" defaultChecked={place?.is_verified ?? true} className="size-4 accent-brand-600" /> Verified (visible to everyone)
      </label>
      <FormMessage state={state} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">{place ? "Save place" : "Add place"}</SubmitButton>
        {place ? (
          <Link href="/admin/places" className="text-sm text-slate-600 hover:underline">
            Cancel / add new
          </Link>
        ) : null}
      </div>
    </form>
  );
}
