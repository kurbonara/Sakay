import { Bus } from "lucide-react";
import Link from "next/link";
import { Container, Skeleton } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { initials } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { DesktopNav, HeaderActions, type HeaderLabels, type NavItem } from "./header-client";

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Sakay home">
      <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-sun-300 shadow-sm">
        <Bus className="size-5" aria-hidden />
      </span>
      <span className="text-lg font-extrabold tracking-tight text-slate-900">Sakay</span>
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-3">{children}</Container>
    </header>
  );
}

export async function SiteHeader() {
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  const items: NavItem[] = [
    { href: "/", label: t("nav.search") },
    { href: "/routes", label: t("nav.routes") },
    { href: "/questions", label: t("nav.qa") },
    { href: "/terminals", label: t("nav.terminals") },
    { href: "/advisories", label: t("nav.advisories") },
  ];
  const labels: HeaderLabels = {
    menu: t("nav.menu"),
    signIn: t("nav.signIn"),
    signUp: t("nav.signUp"),
    signOut: t("nav.signOut"),
    profile: t("nav.profile"),
    saved: t("nav.saved"),
    account: t("nav.account"),
    admin: t("nav.admin"),
    contribute: t("nav.contribute"),
    languageToggle: t("nav.language"),
    nextLang: lang === "fil" ? "en" : "fil",
  };
  const p = viewer.profile;
  const user = p
    ? { name: p.display_name, username: p.username, initials: initials(p.display_name), points: p.points, isStaff: viewer.isStaff }
    : null;

  return (
    <Shell>
      <div className="flex min-w-0 items-center gap-4">
        <Logo />
        <DesktopNav items={items} />
      </div>
      <HeaderActions user={user} labels={labels} items={items} />
    </Shell>
  );
}

export function SiteHeaderSkeleton() {
  return (
    <Shell>
      <div className="flex items-center gap-4">
        <Logo />
        <div className="hidden gap-2 md:flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-5 w-16" />
          ))}
        </div>
      </div>
      <Skeleton className="h-8 w-24" />
    </Shell>
  );
}
