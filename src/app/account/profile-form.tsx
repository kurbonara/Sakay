"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { Field, inputClasses } from "@/components/ui/primitives";
import { updateProfile } from "@/lib/actions/community";
import type { ActionState, Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name to show" htmlFor="display_name">
          <input id="display_name" name="display_name" required maxLength={60} defaultValue={profile.display_name} className={inputClasses} />
        </Field>
        <Field label="Username" htmlFor="username" hint="3-24 lowercase letters, numbers or _">
          <input id="username" name="username" required pattern="[a-z0-9_]{3,24}" defaultValue={profile.username} className={inputClasses} />
        </Field>
      </div>
      <Field label="Home area" htmlFor="home_area" optional>
        <input id="home_area" name="home_area" maxLength={80} defaultValue={profile.home_area ?? ""} placeholder="e.g. Fairview, QC" className={inputClasses} />
      </Field>
      <Field label="Bio" htmlFor="bio" optional>
        <textarea id="bio" name="bio" rows={3} maxLength={280} defaultValue={profile.bio ?? ""} placeholder="Daily commute, routes you know well…" className={inputClasses} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}
