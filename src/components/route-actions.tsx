"use client";

import { Bookmark, BookmarkCheck, Flag, Printer, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useActionState, useOptimistic, useTransition } from "react";
import { ShareButtons } from "@/components/share-buttons";
import { FormMessage, Modal, SubmitButton } from "@/components/ui/client";
import { buttonClasses, cx, inputClasses } from "@/components/ui/primitives";
import { confirmRoute, createReport, toggleSaveRoute } from "@/lib/actions/community";
import { useT } from "@/lib/i18n/client";
import { REPORT_REASON_LABEL } from "@/lib/modes";
import type { ActionState, ContentType } from "@/lib/types";
import { useState } from "react";

export function ConfirmBox({
  routeId,
  accurate,
  outdated,
  mine,
  signedIn,
  published,
}: {
  routeId: string;
  accurate: number;
  outdated: number;
  mine: boolean | null;
  signedIn: boolean;
  published: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Optimistic: the counts move the instant you tap; the server confirms.
  const [view, setView] = useOptimistic({ accurate, outdated, mine }, (s, next: boolean | null) => {
    let { accurate: a, outdated: o } = s;
    if (s.mine === true) a--;
    if (s.mine === false) o--;
    if (next === true) a++;
    if (next === false) o++;
    return { accurate: a, outdated: o, mine: next };
  });

  const vote = (value: boolean) => {
    if (pending) return;
    const next = view.mine === value ? null : value;
    startTransition(async () => {
      setView(next);
      const res = await confirmRoute(routeId, next);
      setError(res?.ok ? null : (res?.message ?? null));
    });
  };

  if (!published) return null;
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-800">{t("route.confirmPrompt")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {signedIn ? (
          <>
            <button
              type="button"
              aria-pressed={view.mine === true}
              disabled={pending}
              onClick={() => vote(true)}
              className={cx(buttonClasses(view.mine === true ? "primary" : "secondary", "md"), view.mine === true && "bg-emerald-600 hover:bg-emerald-700")}
            >
              <ThumbsUp className="size-4" aria-hidden /> {t("route.stillAccurate")} · {view.accurate}
            </button>
            <button
              type="button"
              aria-pressed={view.mine === false}
              disabled={pending}
              onClick={() => vote(false)}
              className={buttonClasses(view.mine === false ? "danger" : "secondary", "md")}
            >
              <ThumbsDown className="size-4" aria-hidden /> {t("route.outdated")} · {view.outdated}
            </button>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 text-sm text-slate-600">
              <ThumbsUp className="size-4" aria-hidden /> {view.accurate}
            </span>
            <span className="inline-flex items-center gap-1 text-sm text-slate-600">
              <ThumbsDown className="size-4" aria-hidden /> {view.outdated}
            </span>
            <Link href={`/login?next=/routes/${routeId}`} className="text-sm font-semibold text-brand-700 underline">
              {t("common.signInToHelp")}
            </Link>
          </>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SaveButton({ routeId, saved, signedIn }: { routeId: string; saved: boolean; signedIn: boolean }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [error, setError] = useState<string | null>(null);
  if (!signedIn) {
    return (
      <Link href={`/login?next=/routes/${routeId}`} className={buttonClasses("secondary", "sm")}>
        <Bookmark className="size-4" aria-hidden /> {t("route.save")}
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-pressed={optimisticSaved}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setOptimisticSaved(!optimisticSaved);
            const res = await toggleSaveRoute(routeId);
            setError(res.ok ? null : res.message);
          })
        }
        className={buttonClasses(optimisticSaved ? "primary" : "secondary", "sm")}
      >
        {optimisticSaved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
        {optimisticSaved ? t("route.saved") : t("route.save")}
      </button>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </span>
  );
}

export function ShareModal({ url, title, imageUrl }: { url: string; title: string; imageUrl?: string }) {
  const t = useT();
  return (
    <Modal
      title={t("route.share")}
      trigger={
        <>
          <Share2 className="size-4" aria-hidden /> {t("route.share")}
        </>
      }
    >
      {() => <ShareButtons url={url} title={title} imageUrl={imageUrl} />}
    </Modal>
  );
}

export function PrintButton() {
  const t = useT();
  return (
    <button type="button" onClick={() => window.print()} className={buttonClasses("secondary", "sm")}>
      <Printer className="size-4" aria-hidden /> {t("route.print")}
    </button>
  );
}

const ROUTE_REASONS = ["fare_changed", "rerouted", "terminal_closed", "schedule_changed", "wrong_info", "duplicate", "spam", "other"];
const POST_REASONS = ["spam", "offensive", "wrong_info", "duplicate", "other"];

export function ReportButton({
  targetType,
  targetId,
  signedIn,
  compact,
}: {
  targetType: ContentType;
  targetId: string;
  signedIn: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const reasons = targetType === "route" || targetType === "place" ? ROUTE_REASONS : POST_REASONS;
  if (!signedIn) {
    return (
      <Link href="/login" className={compact ? "text-xs text-slate-500 hover:text-rose-700" : buttonClasses("ghost", "sm")}>
        <Flag className={compact ? "inline size-3" : "size-4"} aria-hidden /> {compact ? "Report" : t("route.report")}
      </Link>
    );
  }
  return (
    <Modal
      title={t("route.report")}
      triggerClassName={compact ? "inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-700" : buttonClasses("ghost", "sm")}
      trigger={
        <>
          <Flag className={compact ? "size-3" : "size-4"} aria-hidden /> {compact ? "Report" : t("route.report")}
        </>
      }
    >
      {(close) => <ReportForm targetType={targetType} targetId={targetId} reasons={reasons} onDone={close} />}
    </Modal>
  );
}

function ReportForm({ targetType, targetId, reasons, onDone }: { targetType: ContentType; targetId: string; reasons: string[]; onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await createReport(prev, fd);
    if (res?.ok) setTimeout(onDone, 1500);
    return res;
  }, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-800">What&apos;s wrong?</legend>
        {reasons.map((r, i) => (
          <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name="reason" value={r} defaultChecked={i === 0} className="size-4 accent-brand-600" />
            {REPORT_REASON_LABEL[r]}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="report-details" className="mb-1 block text-sm font-medium text-slate-800">
          Details <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea id="report-details" name="details" rows={3} maxLength={1000} className={inputClasses} placeholder="e.g. The fare is now ₱15 since October." />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Sending…" disabled={Boolean(state?.ok)}>
        Send report
      </SubmitButton>
    </form>
  );
}
