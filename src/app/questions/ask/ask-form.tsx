"use client";

import { CheckCircle2, Route as RouteIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { PlaceAutocomplete, type PlaceOption } from "@/components/place-autocomplete";
import { FormMessage, SubmitButton, useActionRedirect } from "@/components/ui/client";
import { Card, Chip, Field, inputClasses } from "@/components/ui/primitives";
import { askQuestion } from "@/lib/actions/community";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import type { ActionState } from "@/lib/types";

type Similar = { id: string; title: string; answer_count: number; has_best_answer: boolean; status: string };
type RouteHit = { id: string; title: string; total_fare: number; total_minutes: number };

/**
 * Ask form with duplicate detection: as you type the title or pick places,
 * it shows existing answered threads and saved routes for the same trip.
 */
export function AskForm({ initialTitle, initialFrom, initialTo }: { initialTitle: string; initialFrom: PlaceOption | null; initialTo: PlaceOption | null }) {
  const t = useT();
  const [state, action] = useActionState<ActionState, FormData>(askQuestion, null);
  useActionRedirect(state);
  const [title, setTitle] = useState(initialTitle);
  const [from, setFrom] = useState<PlaceOption | null>(initialFrom?.id ? initialFrom : null);
  const [to, setTo] = useState<PlaceOption | null>(initialTo?.id ? initialTo : null);
  const [similar, setSimilar] = useState<Similar[] | null>(null);
  const [routes, setRoutes] = useState<RouteHit[]>([]);

  useEffect(() => {
    const ready = title.trim().length >= 6 || (from?.id && to?.id);
    if (!ready) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      const supabase = createClient();
      const [sq, rq] = await Promise.all([
        supabase.rpc("similar_questions", { p_title: title.trim(), p_origin: from?.id ?? null, p_destination: to?.id ?? null, p_limit: 5 }),
        from?.id && to?.id ? supabase.rpc("find_trips", { p_origin: from.id, p_destination: to.id, p_max_legs: 4, p_limit: 3 }) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setSimilar((sq.data ?? []) as Similar[]);
      const trips = (rq.data ?? []) as { single_route_id: string | null; legs: { route_id: string; route_title: string }[]; fare: number; minutes: number }[];
      setRoutes(
        trips
          .filter((tr) => tr.single_route_id)
          .map((tr) => ({ id: tr.single_route_id!, title: tr.legs[0]?.route_title ?? "Route", total_fare: tr.fare, total_minutes: tr.minutes })),
      );
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [title, from?.id, to?.id]);

  const showSuggestions = similar !== null && (title.trim().length >= 6 || (from?.id && to?.id));

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <form action={action} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <PlaceAutocomplete name="origin" label={t("search.from")} placeholder={t("search.fromPlaceholder")} defaultValue={initialFrom} onSelect={setFrom} />
            <PlaceAutocomplete name="destination" label={t("search.to")} placeholder={t("search.toPlaceholder")} defaultValue={initialTo} onSelect={setTo} />
          </div>
          <Field label={t("qa.questionTitle")} htmlFor="q-title">
            <input
              id="q-title"
              name="title"
              required
              minLength={10}
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("qa.questionTitlePlaceholder")}
              className={inputClasses}
            />
          </Field>
          <Field label={t("qa.details")} htmlFor="q-body">
            <textarea id="q-body" name="body" rows={4} maxLength={2000} placeholder={t("qa.detailsPlaceholder")} className={inputClasses} />
          </Field>
          <FormMessage state={state} />
          <SubmitButton pendingText="Posting…" disabled={Boolean(state?.ok)}>
            {t("qa.post")}
          </SubmitButton>
        </form>
      </Card>
      <aside aria-live="polite" className="space-y-3">
        {showSuggestions ? (
          <Card className={similar!.length || routes.length ? "ring-amber-300" : ""}>
            <h2 className="font-semibold text-slate-900">{similar!.length || routes.length ? t("qa.similarTitle") : t("qa.similarNone")}</h2>
            {routes.length ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("qa.matchingRoutes")}</p>
                <ul className="space-y-1">
                  {routes.map((r) => (
                    <li key={r.id}>
                      <Link href={`/routes/${r.id}`} className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
                        <RouteIcon className="size-4 shrink-0" aria-hidden /> {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {similar!.length ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {similar!.map((s) => (
                  <li key={s.id} className="py-2">
                    <Link href={`/questions/${s.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-700">
                      {s.title}
                    </Link>
                    <div className="mt-1 flex gap-1">
                      {s.has_best_answer ? (
                        <Chip tone="emerald">
                          <CheckCircle2 className="size-3" aria-hidden /> {t("qa.best")}
                        </Chip>
                      ) : null}
                      <Chip>{t("qa.answers", { n: s.answer_count })}</Chip>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : (
          <Card className="text-sm text-slate-600">{t("qa.subtitle")}</Card>
        )}
      </aside>
    </div>
  );
}
