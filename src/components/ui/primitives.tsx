import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "sun";
type Size = "sm" | "md" | "lg";

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 select-none",
    size === "sm" && "h-8 px-3 text-sm",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-5 text-base",
    variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
    variant === "secondary" && "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50",
    variant === "ghost" && "text-slate-700 hover:bg-slate-100",
    variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
    variant === "sun" && "bg-sun-400 text-slate-900 hover:bg-sun-300 shadow-sm",
    extra,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={buttonClasses(variant, size, className)} />;
}

export function LinkButton({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClasses(variant, size, className)} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:p-5", className)} />;
}

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
} as const;
export type Tone = keyof typeof TONES;

export function Chip({ tone = "slate", className, children, title }: { tone?: Tone; className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton", className)} />;
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600 sm:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeaderSkeleton({ withActions = false }: { withActions?: boolean }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withActions ? <Skeleton className="h-10 w-36" /> : null}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-slate-400">{icon}</div> : null}
      <p className="font-semibold text-slate-800">{title}</p>
      {body ? <div className="mt-1 max-w-md text-sm text-slate-600">{body}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx("mx-auto w-full max-w-6xl px-4 sm:px-6", className)} />;
}

export function Field({ label, hint, children, htmlFor, optional }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label} {optional ? <span className="font-normal text-slate-500">(optional)</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const inputClasses =
  "block w-full rounded-xl border-0 bg-white px-3 py-2.5 text-base text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm";
