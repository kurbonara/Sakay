"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";
import { buttonClasses, cx } from "./primitives";

type Variant = Parameters<typeof buttonClasses>[0];
type Size = Parameters<typeof buttonClasses>[1];

/** Submit button that disables itself while its form is being sent (no double submits). */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} aria-busy={pending} className={buttonClasses(variant, size, className)}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cx(
        "rounded-xl px-3 py-2 text-sm",
        state.ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
        className,
      )}
    >
      {state.message}
    </p>
  );
}

/** Follow a redirectTo returned by an action (client-side, so it stays instant). */
export function useActionRedirect(state: ActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
}

/**
 * Button that runs a server action, shows a spinner, ignores extra clicks while
 * running, and optionally asks for confirmation first (for destructive actions).
 */
export function ActionButton({
  action,
  children,
  confirm,
  confirmLabel = "Yes, continue",
  variant = "secondary",
  size = "sm",
  className,
  onDone,
  title,
  ariaPressed,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  confirm?: string;
  confirmLabel?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  onDone?: (state: ActionState) => void;
  title?: string;
  ariaPressed?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const run = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await action();
      setState(result);
      onDone?.(result);
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        title={title}
        aria-pressed={ariaPressed}
        disabled={pending}
        aria-busy={pending}
        className={buttonClasses(variant, size, className)}
        onClick={() => (confirm ? dialogRef.current?.showModal() : run())}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
      {state && !state.ok ? (
        <span role="alert" className="text-xs text-rose-700">
          {state.message}
        </span>
      ) : null}
      {confirm ? (
        <dialog ref={dialogRef} className="m-auto w-[min(92vw,420px)] rounded-2xl p-0 shadow-xl">
          <div className="p-5">
            <p className="text-base font-semibold text-slate-900">Are you sure?</p>
            <p className="mt-1 text-sm text-slate-600">{confirm}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={buttonClasses("secondary", "md")} onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button
                type="button"
                className={buttonClasses(variant === "danger" ? "danger" : "primary", "md")}
                onClick={() => {
                  dialogRef.current?.close();
                  run();
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </span>
  );
}

/** A <dialog> opened by a trigger button. Content can contain forms. */
export function Modal({
  trigger,
  title,
  children,
  triggerClassName,
}: {
  trigger: ReactNode;
  title: string;
  children: (close: () => void) => ReactNode;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={triggerClassName ?? buttonClasses("secondary", "sm")} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      <dialog ref={ref} onClose={close} className="m-auto w-[min(94vw,520px)] rounded-2xl p-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="font-semibold text-slate-900">{title}</p>
          <button type="button" onClick={close} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{open ? children(close) : null}</div>
      </dialog>
    </>
  );
}
