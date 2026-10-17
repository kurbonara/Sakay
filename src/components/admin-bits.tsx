import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Container, EmptyState, buttonClasses } from "@/components/ui/primitives";

export function NotAllowed({ adminOnly = false }: { adminOnly?: boolean }) {
  return (
    <Container className="max-w-xl">
      <EmptyState
        icon={<ShieldAlert className="size-8" />}
        title={adminOnly ? "Admins only" : "Moderators only"}
        body={adminOnly ? "This page is only for Sakay admins." : "This area is for Sakay moderators and admins. If you should have access, ask an admin to give you the moderator role."}
        action={
          <Link href="/" className={buttonClasses("primary", "md")}>
            Go home
          </Link>
        }
      />
    </Container>
  );
}

export function StatCard({ label, value, href, tone = "slate" }: { label: string; value: number | string; href?: string; tone?: "slate" | "amber" | "rose" | "emerald" | "blue" }) {
  const tones = {
    slate: "text-slate-900",
    amber: "text-amber-700",
    rose: "text-rose-700",
    emerald: "text-emerald-700",
    blue: "text-brand-700",
  };
  const body = (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
