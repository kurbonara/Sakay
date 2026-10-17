"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/client";
import { Field, inputClasses } from "@/components/ui/primitives";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/lib/actions/auth";
import type { ActionState } from "@/lib/types";

export function SignInForm({ next, error }: { next: string; error?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(signIn, error ? { ok: false, message: error } : null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClasses} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClasses} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
          Forgot password?
        </Link>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState<ActionState, FormData>(signUp, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Name to show" htmlFor="display_name">
        <input id="display_name" name="display_name" required maxLength={60} autoComplete="name" className={inputClasses} />
      </Field>
      <Field label="Username" htmlFor="username" optional hint="3-24 lowercase letters, numbers or _. We'll make one if you leave it blank.">
        <input id="username" name="username" pattern="[a-z0-9_]{3,24}" autoComplete="username" className={inputClasses} />
      </Field>
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClasses} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required className={inputClasses} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClasses} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingText="Sending…" disabled={Boolean(state?.ok)}>
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required className={inputClasses} />
      </Field>
      <FormMessage state={state} />
      {state?.ok ? (
        <Link href="/" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
          Go to Sakay →
        </Link>
      ) : (
        <SubmitButton className="w-full" size="lg" pendingText="Saving…">
          Save new password
        </SubmitButton>
      )}
    </form>
  );
}
