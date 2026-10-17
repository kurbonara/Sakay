"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { Field, inputClasses } from "@/components/ui/primitives";
import { upsertAdvisory } from "@/lib/actions/admin";
import { ADVISORY_KIND_LABEL } from "@/lib/modes";
import type { ActionState } from "@/lib/types";

export type AdvisoryInitial = { id: string; title: string; body: string; kind: string; severity: string; area: string; starts_at: string; ends_at: string } | null;

export function AdvisoryForm({ advisory, timeZone }: { advisory: AdvisoryInitial; timeZone: string }) {
  const [state, action] = useActionState<ActionState, FormData>(upsertAdvisory, null);
  return (
    <form action={action} className="space-y-4" key={advisory?.id ?? "new"}>
      <input type="hidden" name="id" value={advisory?.id ?? ""} />
      <Field label="Title" htmlFor="a-title">
        <input id="a-title" name="title" required minLength={5} maxLength={140} defaultValue={advisory?.title} className={inputClasses} placeholder="e.g. EDSA northbound lane closure near Ortigas" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="a-kind">
          <select id="a-kind" name="kind" defaultValue={advisory?.kind ?? "other"} className={inputClasses}>
            {Object.entries(ADVISORY_KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Severity" htmlFor="a-sev">
          <select id="a-sev" name="severity" defaultValue={advisory?.severity ?? "info"} className={inputClasses}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
      </div>
      <Field label="Area" htmlFor="a-area" optional>
        <input id="a-area" name="area" maxLength={120} defaultValue={advisory?.area} className={inputClasses} placeholder="e.g. Quezon City, EDSA" />
      </Field>
      <Field label="Details" htmlFor="a-body" optional>
        <textarea id="a-body" name="body" rows={4} maxLength={2000} defaultValue={advisory?.body} className={inputClasses} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Starts" htmlFor="a-start" hint={`Blank = now. Times are ${timeZone}.`}>
          <input id="a-start" name="starts_at" type="datetime-local" defaultValue={advisory?.starts_at} className={inputClasses} />
        </Field>
        <Field label="Ends" htmlFor="a-end" optional hint="Disappears for the public at this exact time.">
          <input id="a-end" name="ends_at" type="datetime-local" defaultValue={advisory?.ends_at} className={inputClasses} />
        </Field>
      </div>
      <FormMessage state={state} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">{advisory ? "Save advisory" : "Publish advisory"}</SubmitButton>
        {advisory ? (
          <Link href="/admin/advisories" className="text-sm text-slate-600 hover:underline">
            Cancel / new
          </Link>
        ) : null}
      </div>
    </form>
  );
}
