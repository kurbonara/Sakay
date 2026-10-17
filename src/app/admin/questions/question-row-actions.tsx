"use client";

import { useActionState } from "react";
import { ActionButton, FormMessage, SubmitButton } from "@/components/ui/client";
import { mergeQuestion, setContentRemoved } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/types";

export function MergeInto({ sourceId, targetId, targetTitle }: { sourceId: string; targetId: string; targetTitle: string }) {
  const [state, action] = useActionState<ActionState, FormData>(mergeQuestion, null);
  return (
    <form action={action} className="inline-flex flex-col">
      <input type="hidden" name="source_id" value={sourceId} />
      <input type="hidden" name="target_id" value={targetId} />
      <SubmitButton size="sm" variant="secondary" pendingText="Merging…">
        Merge into “{targetTitle.length > 30 ? `${targetTitle.slice(0, 30)}…` : targetTitle}”
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function RemoveToggle({ id, removed }: { id: string; removed: boolean }) {
  return (
    <ActionButton
      size="sm"
      variant={removed ? "secondary" : "danger"}
      confirm={removed ? undefined : "Hide this question from the public (spam/abuse)?"}
      confirmLabel="Remove"
      action={() => setContentRemoved("question", id, !removed, "moderator")}
    >
      {removed ? "Restore" : "Remove"}
    </ActionButton>
  );
}
