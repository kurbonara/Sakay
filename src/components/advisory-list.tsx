import { AlertOctagon, Info, TriangleAlert } from "lucide-react";
import { Chip, cx } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import { ADVISORY_KIND_LABEL } from "@/lib/modes";
import type { Advisory } from "@/lib/types";

const SEVERITY = {
  info: { icon: Info, box: "bg-brand-50 ring-brand-200", iconColor: "text-brand-600" },
  warning: { icon: TriangleAlert, box: "bg-amber-50 ring-amber-200", iconColor: "text-amber-600" },
  critical: { icon: AlertOctagon, box: "bg-rose-50 ring-rose-200", iconColor: "text-rose-600" },
} as const;

export function AdvisoryItem({ a, labels, now }: { a: Advisory; labels: { until: string; starts: string }; now: number }) {
  const s = SEVERITY[a.severity];
  const upcoming = new Date(a.starts_at).getTime() > now;
  return (
    <article className={cx("print-break flex gap-3 rounded-2xl p-4 ring-1", s.box)}>
      <s.icon className={cx("mt-0.5 size-5 shrink-0", s.iconColor)} aria-hidden />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-900">{a.title}</h3>
          <Chip tone={a.severity === "critical" ? "rose" : a.severity === "warning" ? "amber" : "blue"}>{ADVISORY_KIND_LABEL[a.kind]}</Chip>
        </div>
        {a.body ? <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{a.body}</p> : null}
        <p className="mt-1.5 text-xs text-slate-500">
          {a.area ? `${a.area} · ` : ""}
          {upcoming
            ? labels.starts.replace("{when}", formatDateTime(a.starts_at))
            : a.ends_at
              ? labels.until.replace("{when}", formatDateTime(a.ends_at))
              : ""}
        </p>
      </div>
    </article>
  );
}
