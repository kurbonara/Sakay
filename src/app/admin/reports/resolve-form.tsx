"use client";

import { useActionState } from "react";
import { ActionButton, FormMessage, SubmitButton } from "@/components/ui/client";
import { inputClasses } from "@/components/ui/primitives";
import { resolveReport, setContentRemoved } from "@/lib/actions/admin";
import type { ActionState, ContentType, ReportStatus } from "@/lib/types";

export function ResolveForm({ reportId, status, targetType, targetId }: { reportId: string; status: ReportStatus; targetType: ContentType; targetId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(resolveReport, null);
  if (status !== "open") {
    return (
      <form action={action} className="no-print">
        <input type="hidden" name="report_id" value={reportId} />
        <SubmitButton name="status" value="open" variant="ghost" size="sm">
          Reopen
        </SubmitButton>
        <FormMessage state={state} />
      </form>
    );
  }
  return (
    <div className="no-print space-y-2">
      <form action={action} className="space-y-2">
        <input type="hidden" name="report_id" value={reportId} />
        <input name="note" maxLength={500} placeholder="What did you do? (shown to the reporter)" className={inputClasses} aria-label="Resolution note" />
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="status" value="resolved" size="sm" pendingText="Saving…">
            Resolved (fixed)
          </SubmitButton>
          <SubmitButton name="status" value="dismissed" variant="secondary" size="sm">
            Dismiss
          </SubmitButton>
        </div>
      </form>
      <ActionButton
        variant="danger"
        size="sm"
        confirm={targetType === "route" ? "Archive this route? It will stop showing in search until you publish it again." : "Hide this item from the public? You can restore it later."}
        confirmLabel={targetType === "route" ? "Archive" : "Remove"}
        action={() => setContentRemoved(targetType, targetId, true, `report ${reportId}`)}
      >
        {targetType === "route" ? "Archive route" : targetType === "place" ? "Unverify place" : "Remove content"}
      </ActionButton>
      <FormMessage state={state} />
    </div>
  );
}
