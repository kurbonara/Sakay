"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState } from "react";
import { ActionButton, FormMessage, SubmitButton } from "@/components/ui/client";
import { buttonClasses, inputClasses } from "@/components/ui/primitives";
import { deleteOwnContent, editOwnContent } from "@/lib/actions/community";
import type { ActionState, ContentType } from "@/lib/types";

/**
 * Edit/delete controls for the author's own post. The edit button is only
 * rendered inside the 30-minute window (the page refreshes when it closes),
 * and the database rejects late edits anyway.
 */
export function OwnContentControls({
  type,
  id,
  body,
  title,
  canEdit,
}: {
  type: ContentType;
  id: string;
  body: string;
  title?: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await editOwnContent(prev, fd);
    if (res?.ok) setEditing(false);
    return res;
  }, null);

  return (
    <div className="mt-2">
      {editing ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="id" value={id} />
          {title !== undefined ? <input name="title" defaultValue={title} minLength={10} maxLength={160} className={inputClasses} aria-label="Title" /> : null}
          <textarea name="body" defaultValue={body} rows={4} className={inputClasses} aria-label="Text" />
          <div className="flex gap-2">
            <SubmitButton size="sm" pendingText="Saving…">
              Save changes
            </SubmitButton>
            <button type="button" className={buttonClasses("ghost", "sm")} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
          <FormMessage state={state} />
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700" onClick={() => setEditing(true)}>
              <Pencil className="size-3" aria-hidden /> Edit
            </button>
          ) : null}
          <ActionButton
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-xs font-medium text-slate-500 hover:bg-transparent hover:text-rose-700"
            confirm="This removes your post for everyone. You can't undo this."
            confirmLabel="Delete"
            action={() => deleteOwnContent(type, id)}
          >
            Delete
          </ActionButton>
          {state?.ok ? <FormMessage state={state} /> : null}
        </div>
      )}
    </div>
  );
}
