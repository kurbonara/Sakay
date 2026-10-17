"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/primitives";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/routes", label: "Routes" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/places", label: "Places" },
  { href: "/admin/advisories", label: "Advisories" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users", label: "Members" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="no-print -mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium", active ? "bg-rose-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
