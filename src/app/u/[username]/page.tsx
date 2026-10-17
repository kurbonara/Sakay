import { requestNow } from "@/lib/time";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { Avatar, BadgeList } from "@/components/profile-bits";
import { RouteCard } from "@/components/route-bits";
import { Card, Chip, Container, EmptyState } from "@/components/ui/primitives";
import { getViewer, PROFILE_COLUMNS } from "@/lib/auth";
import { formatDate, timeAgo } from "@/lib/format";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { routeCardLabels } from "@/lib/labels";
import { ROUTE_SUMMARY } from "@/lib/queries";
import type { Profile, RouteSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const [{ t, lang }, { supabase, userId }, labels] = await Promise.all([getI18n(), getViewer(), routeCardLabels()]);
  const { data: p } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("username", decodeURIComponent(username).toLowerCase()).maybeSingle();
  const profile = p as Profile | null;
  if (!profile) notFound();

  const [routesRes, answersRes, questionsRes] = await Promise.all([
    supabase.from("routes").select(ROUTE_SUMMARY).eq("submitted_by", profile.id).eq("status", "published").order("created_at", { ascending: false }).limit(12),
    supabase.from("answers").select("id, body, score, is_best, created_at, question:questions(id, title)").eq("author_id", profile.id).eq("is_removed", false).order("created_at", { ascending: false }).limit(10),
    supabase.from("questions").select("id, title, answer_count, created_at").eq("author_id", profile.id).eq("is_removed", false).order("created_at", { ascending: false }).limit(10),
  ]);
  const routes = (routesRes.data ?? []) as unknown as RouteSummary[];
  const answers = (answersRes.data ?? []) as unknown as { id: string; body: string; score: number; is_best: boolean; created_at: string; question: { id: string; title: string } | null }[];
  const questions = (questionsRes.data ?? []) as { id: string; title: string; answer_count: number; created_at: string }[];
  const now = await requestNow();

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "profiles", filter: `id=eq.${profile.id}` }]} />
      <Container className="space-y-6">
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={profile.display_name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{profile.display_name}</h1>
              {profile.is_banned ? <Chip tone="rose">Suspended</Chip> : null}
            </div>
            <p className="text-sm text-slate-500">
              @{profile.username}
              {profile.home_area ? ` · ${profile.home_area}` : ""} · {t("profile.memberSince", { when: formatDate(profile.created_at) })}
            </p>
            {profile.bio ? <p className="mt-2 text-sm text-slate-700">{profile.bio}</p> : null}
            <div className="mt-3">
              <BadgeList profile={profile} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center sm:w-72">
            {[
              [profile.points, t("contributors.points")],
              [profile.routes_published_count, t("contributors.routes")],
              [profile.answers_count, t("contributors.answers")],
            ].map(([n, label]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 p-2">
                <p className="text-xl font-bold text-slate-900">{n}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </Card>
        {userId === profile.id ? (
          <p className="text-sm">
            <Link href="/account" className="font-semibold text-brand-700 hover:underline">
              {t("nav.account")} →
            </Link>
          </p>
        ) : null}

        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">{t("profile.routes")}</h2>
          {routes.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {routes.map((r) => (
                <RouteCard key={r.id} route={r} labels={labels} lang={lang} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("profile.noRoutes")} />
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">{t("profile.answers")}</h2>
            {answers.length ? (
              <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
                {answers.map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    {a.question ? (
                      <Link href={`/questions/${a.question.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {a.question.title}
                      </Link>
                    ) : null}
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.body}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      {a.is_best ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3.5" aria-hidden /> {t("qa.best")}
                        </span>
                      ) : null}
                      <span>▲ {a.score}</span>
                      <span>· {timeAgo(a.created_at, now, lang)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("profile.noAnswers")} />
            )}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">{t("profile.questions")}</h2>
            {questions.length ? (
              <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
                {questions.map((q) => (
                  <li key={q.id} className="px-4 py-3">
                    <Link href={`/questions/${q.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {q.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("qa.answers", { n: q.answer_count })} · {timeAgo(q.created_at, now, lang)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("qa.empty")} />
            )}
          </section>
        </div>
      </Container>
    </I18nProvider>
  );
}
