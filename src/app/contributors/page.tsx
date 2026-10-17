import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { Avatar, BadgeList } from "@/components/profile-bits";
import { Container, EmptyState, PageHeader } from "@/components/ui/primitives";
import { getViewer, PROFILE_COLUMNS } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Top contributors" };

export default async function ContributorsPage() {
  const [{ t, lang }, { supabase }] = await Promise.all([getI18n(), getViewer()]);
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("is_banned", false).gt("points", 0).order("points", { ascending: false }).limit(50);
  const people = (data ?? []) as Profile[];

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "profiles" }]} />
      <Container className="max-w-3xl">
        <PageHeader title={t("contributors.title")} subtitle={t("contributors.subtitle")} />
        {people.length ? (
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {people.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-6 text-center text-sm font-bold ${i < 3 ? "text-amber-600" : "text-slate-400"}`}>{i < 3 ? <Trophy className="mx-auto size-4" aria-label={`#${i + 1}`} /> : i + 1}</span>
                <Avatar name={p.display_name} />
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${p.username}`} className="font-semibold text-slate-900 hover:text-brand-700">
                    {p.display_name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {p.routes_published_count} {t("contributors.routes")} · {p.answers_count} {t("contributors.answers")} · {p.best_answers_count} {t("contributors.best")}
                  </p>
                  <div className="mt-1 hidden sm:block">
                    <BadgeList profile={p} />
                  </div>
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-lg font-bold text-slate-900">{p.points}</span>
                  <span className="text-xs text-slate-500">{t("contributors.points")}</span>
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={<Trophy className="size-8" />} title="No contributors yet. Be the first!" body="Share a route or answer a question to earn points." />
        )}
        <p className="mt-4 text-xs text-slate-500">
          Points: +20 published route · +15 best answer · +5 per upvote · +3 accepted report · +2 answer · +1 question or confirmation.
        </p>
      </Container>
    </I18nProvider>
  );
}
