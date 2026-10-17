"use client";

import { GitMerge, Shield } from "lucide-react";
import { useActionState } from "react";
import { ActionButton, FormMessage, Modal, SubmitButton } from "@/components/ui/client";
import { inputClasses } from "@/components/ui/primitives";
import { mergeQuestion, setContentRemoved, setQuestionClosed } from "@/lib/actions/admin";
import type { ActionState, Answer, Question } from "@/lib/types";

/** Moderator controls shown inline on a thread. The database re-checks the role. */
export function ModTools({ question, answer }: { question?: Question; answer?: Answer }) {
  if (answer) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-rose-200 pt-2">
        <Shield className="size-3.5 text-rose-600" aria-hidden />
        <ActionButton
          variant={answer.is_removed ? "secondary" : "danger"}
          size="sm"
          confirm={answer.is_removed ? undefined : "Hide this answer from everyone (spam, abuse, wrong info)? You can restore it later."}
          confirmLabel="Remove"
          action={() => setContentRemoved("answer", answer.id, !answer.is_removed, "moderator")}
        >
          {answer.is_removed ? "Restore answer" : "Remove answer"}
        </ActionButton>
      </div>
    );
  }
  if (!question) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-rose-50/60 p-2 ring-1 ring-rose-100">
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
        <Shield className="size-3.5" aria-hidden /> Moderator
      </span>
      {question.status !== "merged" ? (
        <Modal
          title="Merge into another question"
          trigger={
            <>
              <GitMerge className="size-4" aria-hidden /> Merge duplicate
            </>
          }
        >
          {(close) => <MergeForm sourceId={question.id} onDone={close} />}
        </Modal>
      ) : null}
      {question.status !== "merged" ? (
        <ActionButton action={() => setQuestionClosed(question.id, question.status !== "closed")}>
          {question.status === "closed" ? "Reopen" : "Close to new answers"}
        </ActionButton>
      ) : null}
      <ActionButton
        variant={question.is_removed ? "secondary" : "danger"}
        confirm={question.is_removed ? undefined : "Hide this question and its thread from the public? You can restore it later."}
        confirmLabel="Remove"
        action={() => setContentRemoved("question", question.id, !question.is_removed, "moderator")}
      >
        {question.is_removed ? "Restore question" : "Remove as spam"}
      </ActionButton>
    </div>
  );
}

function MergeForm({ sourceId, onDone }: { sourceId: string; onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await mergeQuestion(prev, fd);
    if (res?.ok) setTimeout(onDone, 800);
    return res;
  }, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="source_id" value={sourceId} />
      <p className="text-sm text-slate-600">
        Paste the link (or ID) of the main thread. All answers here will move there, and this question will redirect to it.
      </p>
      <input name="target_id" required placeholder="https://…/questions/xxxxxxxx-…" className={inputClasses} aria-label="Target question link" />
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingText="Merging…">
        Merge questions
      </SubmitButton>
    </form>
  );
}
