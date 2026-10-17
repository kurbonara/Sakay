"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setLanguage } from "@/lib/actions/auth";
import { signOut } from "@/lib/actions/auth";
import { buttonClasses, cx } from "@/components/ui/primitives";

export type NavItem = { href: string; label: string };
export type HeaderUser = { name: string; username: string; initials: string; points: number; isStaff: boolean } | null;
export type HeaderLabels = {
  menu: string;
  signIn: string;
  signUp: string;
  signOut: string;
  profile: string;
  saved: string;
  account: string;
  admin: string;
  contribute: string;
  languageToggle: string;
  nextLang: "en" | "fil";
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className={cx(
            "rounded-lg px-3 py-2 text-sm font-medium transition",
            isActive(pathname, item.href) ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function LanguageButton({ labels, className }: { labels: HeaderLabels; className?: string }) {
  return (
    <form action={setLanguage}>
      <input type="hidden" name="lang" value={labels.nextLang} />
      <button type="submit" className={className ?? "rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"} title="Switch language">
        {labels.languageToggle}
      </button>
    </form>
  );
}

function UserLinks({ user, labels, onNavigate }: { user: NonNullable<HeaderUser>; labels: HeaderLabels; onNavigate?: () => void }) {
  const link = "block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
  return (
    <>
      <Link href={`/u/${user.username}`} className={link} onClick={onNavigate}>
        {labels.profile}
      </Link>
      <Link href="/saved" className={link} onClick={onNavigate}>
        {labels.saved}
      </Link>
      <Link href="/account" className={link} onClick={onNavigate}>
        {labels.account}
      </Link>
      {user.isStaff ? (
        <Link href="/admin" className={cx(link, "font-semibold text-rose-700")} onClick={onNavigate}>
          {labels.admin}
        </Link>
      ) : null}
      <form action={signOut}>
        <button type="submit" className={cx(link, "w-full text-left")}>
          {labels.signOut}
        </button>
      </form>
    </>
  );
}

export function HeaderActions({ user, labels, items }: { user: HeaderUser; labels: HeaderLabels; items: NavItem[] }) {
  const [userOpen, setUserOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const userRef = useClickOutside(userOpen, () => setUserOpen(false));
  const menuRef = useClickOutside(menuOpen, () => setMenuOpen(false));
  const pathname = usePathname();

  // Close menus after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setUserOpen(false);
    setMenuOpen(false);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link href="/routes/new" className={buttonClasses("sun", "sm", "hidden lg:inline-flex")}>
        {labels.contribute}
      </Link>
      <div className="hidden md:block">
        <LanguageButton labels={labels} />
      </div>

      {/* Desktop account menu */}
      {user ? (
        <div ref={userRef} className="relative hidden md:block">
          <button
            type="button"
            aria-expanded={userOpen}
            aria-haspopup="menu"
            onClick={() => setUserOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100"
          >
            <span className="grid size-8 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{user.initials}</span>
            <span className="max-w-28 truncate text-sm font-medium text-slate-800">{user.name}</span>
            <ChevronDown className="size-4 text-slate-500" aria-hidden />
          </button>
          {userOpen ? (
            <div role="menu" className="absolute right-0 z-50 mt-2 w-56 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
              <p className="px-3 pb-2 pt-1 text-xs text-slate-500">
                @{user.username} · {user.points} pts
              </p>
              <UserLinks user={user} labels={labels} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="hidden items-center gap-1.5 md:flex">
          <Link href="/login" className={buttonClasses("ghost", "sm")}>
            {labels.signIn}
          </Link>
          <Link href="/signup" className={buttonClasses("primary", "sm")}>
            {labels.signUp}
          </Link>
        </div>
      )}

      {/* Phone menu: everything collapses into one dropdown */}
      <div ref={menuRef} className="relative md:hidden">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
          className={buttonClasses("secondary", "sm")}
        >
          {menuOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          {labels.menu}
        </button>
        {menuOpen ? (
          <div id="mobile-menu" className="absolute right-0 z-50 mt-2 w-[min(88vw,300px)] rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
            <nav aria-label="Mobile" className="grid">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={cx(
                    "rounded-lg px-3 py-2.5 text-sm font-medium",
                    isActive(pathname, item.href) ? "bg-brand-50 text-brand-700" : "text-slate-800 hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/routes/new" className={buttonClasses("sun", "md", "my-2")}>
                {labels.contribute}
              </Link>
            </nav>
            <div className="border-t border-slate-100 pt-2">
              {user ? (
                <>
                  <p className="px-3 pb-1 text-xs text-slate-500">
                    {user.name} · @{user.username} · {user.points} pts
                  </p>
                  <UserLinks user={user} labels={labels} />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 p-1">
                  <Link href="/login" className={buttonClasses("secondary", "md")}>
                    {labels.signIn}
                  </Link>
                  <Link href="/signup" className={buttonClasses("primary", "md")}>
                    {labels.signUp}
                  </Link>
                </div>
              )}
              <LanguageButton labels={labels} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
