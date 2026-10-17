"use client";

import { ArrowBigDown, ArrowBigUp, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useOptimistic, useRef, useState, useTransition } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { buttonClasses, cx, inputClasses } from "@/components/ui/primitives";
import { markBestAnswer, postAnswer, voteAnswer } from "@/lib/actions/community";
import { useT } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/types";

export function VoteButtons({ answerId, score, myVote, canVote, signedIn }: { answerId: string; score: number; myVote: -1 | 0 | 1; canVote: boolean; signedIn: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useOptimistic({ score, myVote }, (s, next: -1 | 0 | 1) => ({ score: s.score - s.myVote + next, myVote: next }));

  const vote = (value: -1 | 1) => {
    if (pending || !canVote) return;
    const next = view.myVote === value ? 0 : value;
    startTransition(async () => {
      setView(next);
      const res = await voteAnswer(answerId, next);
      setError(res.ok ? null : res.message);
    });
  };

  const disabledTitle = !signedIn ? "Sign in to vote" : !canVote ? "You can't vote on your own answer" : undefined;
  return (
    <div className="flex flex-col items-center gap-0.5" title={disabledTitle}>
      <button
        type="button"
        aria-label="Upvote (helpful)"
        aria-pressed={view.myVote === 1}
        disabled={!canVote || pending}
        onClick={() => vote(1)}
        className={cx("rounded-lg p-1 transition disabled:opacity-40", view.myVote === 1 ? "text-brand-600" : "text-slate-400 hover:text-slate-700")}
      >
        <ArrowBigUp className="size-7" fill={view.myVote === 1 ? "currentColor" : "none"} />
      </button>
      <span className="text-sm font-bold text-slate-800" aria-label={`Score ${view.score}`}>
        {view.score}
      </span>
      <button
        type="button"
        aria-label="Downvote (not helpful)"
        aria-pressed={view.myVote === -1}
        disabled={!canVote || pending}
        onClick={() => vote(-1)}
        className={cx("rounded-lg p-1 transition disabled:opacity-40", view.myVote === -1 ? "text-rose-600" : "text-slate-400 hover:text-slate-700")}
      >
        <ArrowBigDown className="size-7" fill={view.myVote === -1 ? "currentColor" : "none"} />
      </button>
      {error ? <span className="max-w-20 text-center text-[10px] text-rose-700">{error}</span> : null}
    </div>
  );
}

export function BestAnswerButton({ answerId, isBest }: { answerId: string; isBest: boolean }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await markBestAnswer(answerId);
            setError(res?.ok ? null : (res?.message ?? null));
          })
        }
        className={buttonClasses(isBest ? "secondary" : "ghost", "sm", isBest ? "" : "text-emerald-700")}
      >
        <CheckCircle2 className="size-4" aria-hidden /> {isBest ? t("qa.unmarkBest") : t("qa.markBest")}
      </button>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </span>
  );
}

export function AnswerForm({ questionId, routes, signedIn }: { questionId: string; routes: { id: string; title: string }[]; signedIn: boolean }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await postAnswer(prev, fd);
    if (res?.ok) formRef.current?.reset();
    return res;
  }, null);
  if (!signedIn) {
    return (
      <p className="text-sm text-slate-600">
        <Link href={`/login?next=/questions/${questionId}`} className="font-semibold text-brand-700 underline">
          {t("nav.signIn")}
        </Link>{" "}
        · {t("common.signInToHelp")}
      </p>
    );
  }
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="question_id" value={questionId} />
      <label htmlFor="answer-body" className="block text-sm font-medium text-slate-800">
        {t("qa.yourAnswer")}
      </label>
      <textarea id="answer-body" name="body" required minLength={2} maxLength={3000} rows={5} placeholder={t("qa.answerPlaceholder")} className={inputClasses} />
      {routes.length ? (
        <div>
          <label htmlFor="answer-route" className="mb-1 block text-sm font-medium text-slate-800">
            {t("qa.linkRoute")}
          </label>
          <select id="answer-route" name="route_id" className={inputClasses} defaultValue="">
            <option value="">—</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton pendingText="Posting…">{t("qa.postAnswer")}</SubmitButton>
    </form>
  );
}
