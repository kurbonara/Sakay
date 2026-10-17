import { requestNow } from "@/lib/time";
import { ArrowRight, MessageCircleQuestion, PlusCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AdvisoryItem } from "@/components/advisory-list";
import { LiveRefresh } from "@/components/live-refresh";
import { RecentSearches, type RecentSearch } from "@/components/recent-searches";
import { RouteCard, RouteGridSkeleton } from "@/components/route-bits";
import { QuestionListSkeleton } from "@/components/skeletons";
import { routeCardLabels } from "@/lib/labels";
import { TripSearchForm } from "@/components/trip-search-form";
import { Card, Container, LinkButton, Skeleton } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { ADVISORY, QUESTION, ROUTE_SUMMARY } from "@/lib/queries";
import type { Advisory, Question, RouteSummary } from "@/lib/types";

export default async function HomePage() {
  const { t, lang } = await getI18n();
  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "advisories" }, { table: "routes" }, { table: "questions" }]} />
      <Container className="space-y-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-5 text-white shadow-lg sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-sun-300">{t("appTagline")}</p>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("home.title")}</h1>
              <p className="mt-2 max-w-xl text-brand-100">{t("home.subtitle")}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-xl sm:p-5">
              <TripSearchForm />
            </div>
          </div>
        </section>

        <Suspense fallback={<Skeleton className="h-20 w-full rounded-2xl" />}>
          <Advisories />
        </Suspense>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("home.recentSearches")}</h2>
          <Suspense fallback={<Skeleton className="h-9 w-full max-w-lg rounded-full" />}>
            <MyRecentSearches emptyText={t("home.noRecent")} />
          </Suspense>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">{t("home.popular")}</h2>
            <Link href="/routes" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              {t("home.seeAll")} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <Suspense fallback={<RouteGridSkeleton count={6} />}>
            <PopularRoutes />
          </Suspense>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">{t("home.recentQuestions")}</h2>
              <Link href="/questions" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                {t("home.seeAll")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <Suspense fallback={<QuestionListSkeleton />}>
              <RecentQuestions />
            </Suspense>
          </section>
          <div className="grid gap-4">
            <Card className="bg-sun-300/30 ring-sun-400/40">
              <MessageCircleQuestion className="size-6 text-amber-700" aria-hidden />
              <h3 className="mt-2 font-bold text-slate-900">{t("home.askCta")}</h3>
              <p className="mt-1 text-sm text-slate-700">{t("home.askCtaBody")}</p>
              <LinkButton href="/questions/ask" variant="primary" className="mt-3">
                {t("home.askButton")}
              </LinkButton>
            </Card>
            <Card>
              <PlusCircle className="size-6 text-emerald-600" aria-hidden />
              <h3 className="mt-2 font-bold text-slate-900">{t("home.contributeCta")}</h3>
              <p className="mt-1 text-sm text-slate-700">{t("home.contributeCtaBody")}</p>
              <LinkButton href="/routes/new" variant="secondary" className="mt-3">
                {t("nav.contribute")}
              </LinkButton>
            </Card>
          </div>
        </div>
      </Container>
    </I18nProvider>
  );
}

async function Advisories() {
  const [{ supabase }, { t }] = await Promise.all([getViewer(), getI18n()]);
  const now = await requestNow();
  const nowIso = new Date(now).toISOString();
  const { data } = await supabase
    .from("advisories")
    .select(ADVISORY)
    .lte("starts_at", nowIso)
    .order("severity", { ascending: false })
    .order("starts_at", { ascending: false })
    .limit(3);
  const items = (data ?? []) as Advisory[];
  if (!items.length) return null;
  return (
    <section aria-label={t("home.activeAdvisories")} className="space-y-2">
      <LiveRefresh boundaries={items.map((a) => a.ends_at)} />
      {items.map((a) => (
        <AdvisoryItem key={a.id} a={a} now={now} labels={{ until: t("advisories.until"), starts: t("advisories.starts") }} />
      ))}
      <Link href="/advisories" className="inline-block text-sm font-semibold text-brand-700 hover:underline">
        {t("home.seeAll")}
      </Link>
    </section>
  );
}

async function MyRecentSearches({ emptyText }: { emptyText: string }) {
  const { supabase, userId } = await getViewer();
  let server: RecentSearch[] = [];
  if (userId) {
    const { data } = await supabase
      .from("search_logs")
      .select("origin_text, destination_text, origin_place_id, destination_place_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);
    server = (data ?? []).map((r) => ({ from: r.origin_text, to: r.destination_text, fromId: r.origin_place_id, toId: r.destination_place_id }));
  }
  return <RecentSearches server={server} emptyText={emptyText} />;
}

async function PopularRoutes() {
  const [{ supabase }, labels, { lang }] = await Promise.all([getViewer(), routeCardLabels(), getI18n()]);
  const { data } = await supabase
    .from("routes")
    .select(ROUTE_SUMMARY)
    .eq("status", "published")
    .order("save_count", { ascending: false })
    .order("still_accurate_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);
  const routes = (data ?? []) as unknown as RouteSummary[];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {routes.map((r) => (
        <RouteCard key={r.id} route={r} labels={labels} lang={lang} />
      ))}
    </div>
  );
}

async function RecentQuestions() {
  const [{ supabase }, { t, lang }] = await Promise.all([getViewer(), getI18n()]);
  const { data } = await supabase
    .from("questions")
    .select(QUESTION)
    .eq("is_removed", false)
    .neq("status", "merged")
    .order("last_activity_at", { ascending: false })
    .limit(6);
  const questions = (data ?? []) as unknown as Question[];
  if (!questions.length) {
    return <p className="rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">{t("qa.empty")}</p>;
  }
  const now = await requestNow();
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      {questions.map((q) => (
        <li key={q.id}>
          <Link href={`/questions/${q.id}`} prefetch className="block px-4 py-3 hover:bg-slate-50">
            <p className="line-clamp-1 font-medium text-slate-900">{q.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {q.answer_count ? t("qa.answers", { n: q.answer_count }) : t("qa.noAnswers")} · {timeAgo(q.last_activity_at, now, lang)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
