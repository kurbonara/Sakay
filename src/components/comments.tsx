"use client";

import { Lightbulb, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { inputClasses } from "@/components/ui/primitives";
import { addRouteComment } from "@/lib/actions/community";
import { useT } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/types";

export function CommentForm({ routeId, signedIn }: { routeId: string; signedIn: boolean }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await addRouteComment(prev, fd);
    if (res?.ok) formRef.current?.reset();
    return res;
  }, null);
  if (!signedIn) {
    return (
      <p className="text-sm text-slate-600">
        <Link href={`/login?next=/routes/${routeId}`} className="font-semibold text-brand-700 underline">
          {t("nav.signIn")}
        </Link>{" "}
        · {t("route.addTip")}
      </p>
    );
  }
  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="route_id" value={routeId} />
      <label htmlFor="tip-body" className="sr-only">
        {t("route.addTip")}
      </label>
      <textarea id="tip-body" name="body" required minLength={2} maxLength={1000} rows={3} placeholder={t("route.tipPlaceholder")} className={inputClasses} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-3 text-sm text-slate-700">
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="kind" value="tip" defaultChecked className="accent-brand-600" />
            <Lightbulb className="size-4 text-amber-500" aria-hidden /> Tip
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="kind" value="comment" className="accent-brand-600" />
            <MessageSquare className="size-4 text-slate-500" aria-hidden /> Comment
          </label>
        </div>
        <SubmitButton size="sm" pendingText="Posting…">
          {t("route.addTip")}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
