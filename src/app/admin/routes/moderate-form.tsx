"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { inputClasses } from "@/components/ui/primitives";
import { moderateRoute } from "@/lib/actions/admin";
import type { ActionState, RouteStatus } from "@/lib/types";

export function ModerateForm({ routeId, status }: { routeId: string; status: RouteStatus }) {
  const [state, action] = useActionState<ActionState, FormData>(moderateRoute, null);
  const [note, setNote] = useState("");
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="route_id" value={routeId} />
      <textarea
        name="note"
        rows={2}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note to the contributor (required when rejecting)"
        className={inputClasses}
        aria-label="Moderator note"
      />
      <div className="flex flex-wrap gap-2">
        {status !== "published" ? (
          <SubmitButton name="decision" value="publish" size="sm" pendingText="Saving…">
            Publish
          </SubmitButton>
        ) : null}
        {status === "pending" ? (
          <SubmitButton name="decision" value="reject" variant="danger" size="sm" disabled={note.trim().length < 3}>
            Reject
          </SubmitButton>
        ) : null}
        {status === "published" ? (
          <SubmitButton name="decision" value="archive" variant="secondary" size="sm">
            Archive
          </SubmitButton>
        ) : null}
        {status === "rejected" || status === "archived" ? (
          <SubmitButton name="decision" value="pending" variant="secondary" size="sm">
            Move back to pending
          </SubmitButton>
        ) : null}
      </div>
      <FormMessage state={state} />
    </form>
  );
}
