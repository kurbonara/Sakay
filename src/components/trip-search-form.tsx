"use client";

import { ArrowDownUp, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PlaceAutocomplete, type PlaceOption } from "@/components/place-autocomplete";
import { buttonClasses, cx } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";
import { rememberSearch } from "@/components/recent-searches";

type Value = { text: string; place: PlaceOption | null };

export function TripSearchForm({
  initialFrom,
  initialTo,
  compact,
}: {
  initialFrom?: Value;
  initialTo?: Value;
  compact?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState<Value>(initialFrom ?? { text: "", place: null });
  const [to, setTo] = useState<Value>(initialTo ?? { text: "", place: null });
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const asDefault = (v: Value): PlaceOption | null => (v.place ? v.place : v.text ? { id: "", name: v.text } : null);

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const fromText = String(data.get("from_text") ?? "").trim();
    const toText = String(data.get("to_text") ?? "").trim();
    if (fromText.length < 2 || toText.length < 2) {
      setError(t("search.enterBoth"));
      return;
    }
    setError(null);
    const params = new URLSearchParams({ from: fromText, to: toText });
    const fromId = String(data.get("from_id") ?? "");
    const toId = String(data.get("to_id") ?? "");
    if (fromId) params.set("fromId", fromId);
    if (toId) params.set("toId", toId);
    rememberSearch({ from: fromText, to: toText, fromId, toId });
    startTransition(() => router.push(`/search?${params.toString()}`));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) submit(e.currentTarget);
      }}
      className={cx("grid gap-3", compact ? "sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end" : "")}
      noValidate
    >
      <PlaceAutocomplete
        key={`from-${version}`}
        name="from"
        label={t("search.from")}
        placeholder={t("search.fromPlaceholder")}
        defaultValue={asDefault(from)}
        onSelect={(p) => setFrom((v) => ({ text: p?.name ?? v.text, place: p }))}
      />
      <div className={cx("flex", compact ? "justify-center sm:pb-1" : "-my-2 justify-end")}>
        <button
          type="button"
          onClick={() => {
            const f = document.querySelector<HTMLInputElement>('input[name="from_text"]')?.value ?? from.text;
            const tt = document.querySelector<HTMLInputElement>('input[name="to_text"]')?.value ?? to.text;
            setFrom({ text: tt, place: to.place && to.place.name === tt ? to.place : null });
            setTo({ text: f, place: from.place && from.place.name === f ? from.place : null });
            setVersion((v) => v + 1);
          }}
          className="rounded-full bg-white p-2 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          aria-label={t("search.swap")}
          title={t("search.swap")}
        >
          <ArrowDownUp className="size-4" aria-hidden />
        </button>
      </div>
      <PlaceAutocomplete
        key={`to-${version}`}
        name="to"
        label={t("search.to")}
        placeholder={t("search.toPlaceholder")}
        defaultValue={asDefault(to)}
        onSelect={(p) => setTo((v) => ({ text: p?.name ?? v.text, place: p }))}
      />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", cx("w-full", compact && "sm:w-auto"))}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Search className="size-5" aria-hidden />}
        {t("search.submit")}
      </button>
      {error ? (
        <p role="alert" className={cx("text-sm text-rose-700", compact && "sm:col-span-4")}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
