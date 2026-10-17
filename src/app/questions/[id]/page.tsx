import { requestNow } from "@/lib/time";
import { ArrowLeft, CheckCircle2, GitMerge, Route as RouteIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { OwnContentControls } from "@/components/own-content";
import { ShareButtons } from "@/components/share-buttons";
import { Card, Chip, Container, EmptyState } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { formatDateTime, timeAgo } from "@/lib/format";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { getPublicQuestionMeta } from "@/lib/public-data";
import { ANSWER, QUESTION } from "@/lib/queries";
import type { Answer, AuthorRef, Question } from "@/lib/types";
import { ReportButton } from "@/components/route-actions";
import { ModTools } from "./mod-tools";
import { AnswerForm, BestAnswerButton, VoteButtons } from "./thread-client";

export async function generateMetadata({ params }: PageProps<"/questions/[id]">): Promise<Metadata> {
  const { id } = await params;
  const q = await getPublicQuestionMeta(id);
  return q ? { title: q.title, description: `${q.answer_count} answer(s) on Sakay, the commuter Q&A.` } : { title: "Question" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EDIT_WINDOW_MS = 30 * 60 * 1000;

function AuthorLine({ author, label }: { author: AuthorRef; label: string }) {
  if (!author) return <span>{label}</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Link href={`/u/${author.username}`} className="font-medium text-slate-700 hover:underline">
        {author.display_name}
      </Link>
      {author.role !== "member" ? <Chip tone="rose">{author.role === "admin" ? "Admin" : "Moderator"}</Chip> : null}
    </span>
  );
}

export default async function QuestionPage({ params, searchParams }: PageProps<"/questions/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const [{ t, lang }, viewer] = await Promise.all([getI18n(), getViewer()]);
  const { supabase, userId, isStaff } = viewer;

  const [qRes, aRes, vRes, savedRes] = await Promise.all([
    supabase.from("questions").select(QUESTION).eq("id", id).maybeSingle(),
    supabase.from("answers").select(ANSWER).eq("question_id", id).order("is_best", { ascending: false }).order("score", { ascending: false }).order("created_at"),
    userId ? supabase.from("answer_votes").select("answer_id, value").eq("user_id", userId) : Promise.resolve({ data: [] }),
    userId ? supabase.from("route_saves").select("route:routes(id, title)").eq("user_id", userId).limit(30) : Promise.resolve({ data: [] }),
  ]);
  const question = qRes.data as unknown as Question | null;
  if (!question) notFound();
  if (question.status === "merged" && question.merged_into_id && sp.stay !== "1") {
    redirect(`/questions/${question.merged_into_id}?from=${question.id}`);
  }
  const answers = ((aRes.data ?? []) as unknown as Answer[]).filter((a) => !a.is_removed || isStaff || a.author_id === userId);
  const votes = new Map(((vRes.data ?? []) as { answer_id: string; value: number }[]).map((v) => [v.answer_id, v.value as -1 | 1]));

  // Routes the answerer can link: their saved ones plus routes for this trip.
  const linkable = new Map<string, string>();
  for (const s of (savedRes.data ?? []) as unknown as { route: { id: string; title: string } | null }[]) if (s.route) linkable.set(s.route.id, s.route.title);
  if (question.origin_place_id && question.destination_place_id) {
    const { data } = await supabase.from("routes").select("id, title").eq("status", "published").eq("origin_place_id", question.origin_place_id).eq("destination_place_id", question.destination_place_id).limit(10);
    for (const r of data ?? []) linkable.set(r.id, r.title);
  }

  const isAsker = Boolean(userId && question.author_id === userId);
  const now = await requestNow();
  const myWindowEnds = [
    ...(isAsker ? [question.created_at] : []),
    ...answers.filter((a) => a.author_id === userId).map((a) => a.created_at),
  ].map((c) => new Date(new Date(c).getTime() + EDIT_WINDOW_MS).toISOString());
  const searchHref =
    question.origin_text && question.destination_text
      ? `/search?${new URLSearchParams({
          from: question.origin_text,
          to: question.destination_text,
          ...(question.origin_place_id ? { fromId: question.origin_place_id } : {}),
          ...(question.destination_place_id ? { toId: question.destination_place_id } : {}),
        }).toString()}`
      : null;

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh
        tables={[
          { table: "questions", filter: `id=eq.${question.id}` },
          { table: "answers", filter: `question_id=eq.${question.id}` },
        ]}
        boundaries={myWindowEnds}
      />
      <Container className="max-w-3xl space-y-5">
        <Link href="/questions" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden /> {t("qa.title")}
        </Link>

        {typeof sp.from === "string" ? (
          <p className="flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800 ring-1 ring-brand-200">
            <GitMerge className="size-4" aria-hidden /> A similar question was merged into this thread so all answers are in one place.
          </p>
        ) : null}
        {question.status === "merged" ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            {t("qa.merged")}{" "}
            <Link className="font-semibold underline" href={`/questions/${question.merged_into_id}`}>
              {t("qa.goToThread")}
            </Link>
          </p>
        ) : null}

        <Card>
          <div className="flex flex-wrap items-center gap-1.5">
            {question.best_answer_id ? (
              <Chip tone="emerald">
                <CheckCircle2 className="size-3" aria-hidden /> {t("qa.resolved")}
              </Chip>
            ) : question.answer_count ? (
              <Chip tone="blue">{t("qa.answered")}</Chip>
            ) : (
              <Chip>{t("qa.unanswered")}</Chip>
            )}
            {question.status === "closed" ? <Chip tone="rose">Closed</Chip> : null}
            {question.is_removed ? <Chip tone="rose">Removed</Chip> : null}
          </div>
          <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{question.title}</h1>
          {question.origin_text || question.destination_text ? (
            <p className="mt-1 text-sm text-slate-600">
              {question.origin_text ?? "?"} → {question.destination_text ?? "?"}
              {searchHref ? (
                <>
                  {" · "}
                  <Link href={searchHref} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                    <RouteIcon className="size-3.5" aria-hidden /> Search saved routes
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {question.body ? <p className="mt-3 whitespace-pre-line text-slate-800">{question.body}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <AuthorLine author={question.author} label={t("common.deletedUser")} />
            <span>· {formatDateTime(question.created_at)}</span>
            {!isAsker ? (
              <span className="ml-auto">
                <ReportButton targetType="question" targetId={question.id} signedIn={Boolean(userId)} compact />
              </span>
            ) : null}
          </div>
          {isAsker && !question.is_removed ? (
            <OwnContentControls type="question" id={question.id} title={question.title} body={question.body ?? ""} canEdit={now - new Date(question.created_at).getTime() < EDIT_WINDOW_MS} />
          ) : null}
          {isStaff ? <ModTools question={question} /> : null}
        </Card>

        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">{t("qa.answers", { n: question.answer_count })}</h2>
          {answers.length ? (
            <ul className="space-y-3">
              {answers.map((a) => {
                const mineAnswer = a.author_id === userId;
                return (
                  <li key={a.id}>
                    <Card className={a.is_best ? "ring-2 ring-emerald-400" : a.is_removed ? "opacity-60" : ""}>
                      <div className="flex gap-3">
                        <VoteButtons answerId={a.id} score={a.score} myVote={votes.get(a.id) ?? 0} canVote={Boolean(userId) && !mineAnswer && !a.is_removed} signedIn={Boolean(userId)} />
                        <div className="min-w-0 flex-1">
                          {a.is_best ? (
                            <p className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                              <CheckCircle2 className="size-4" aria-hidden /> {t("qa.best")}
                            </p>
                          ) : null}
                          {a.is_removed ? <Chip tone="rose">Removed</Chip> : null}
                          <p className="whitespace-pre-line text-slate-800">{a.body}</p>
                          {a.route ? (
                            <Link href={`/routes/${a.route.id}`} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100">
                              <RouteIcon className="size-4" aria-hidden /> {a.route.title}
                            </Link>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <AuthorLine author={a.author} label={t("common.deletedUser")} />
                            <span>· {timeAgo(a.created_at, now, lang)}</span>
                            {(isAsker || isStaff) && !a.is_removed && question.status !== "merged" ? <BestAnswerButton answerId={a.id} isBest={a.is_best} /> : null}
                            {!mineAnswer ? (
                              <span className="ml-auto">
                                <ReportButton targetType="answer" targetId={a.id} signedIn={Boolean(userId)} compact />
                              </span>
                            ) : null}
                          </div>
                          {mineAnswer && !a.is_removed ? (
                            <OwnContentControls type="answer" id={a.id} body={a.body} canEdit={now - new Date(a.created_at).getTime() < EDIT_WINDOW_MS} />
                          ) : null}
                          {isStaff ? <ModTools answer={a} /> : null}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title={t("qa.noAnswers")} body={t("common.signInToHelp")} />
          )}
        </section>

        {question.status === "open" || question.status === "answered" ? (
          <Card>
            <AnswerForm questionId={question.id} signedIn={Boolean(userId)} routes={[...linkable].map(([rid, title]) => ({ id: rid, title }))} />
          </Card>
        ) : question.status === "closed" ? (
          <p className="text-sm text-slate-600">{t("qa.closed")}</p>
        ) : null}

        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Share this thread</h2>
          <ShareButtons url={`${siteUrl()}/questions/${question.id}`} title={question.title} />
        </Card>
      </Container>
    </I18nProvider>
  );
}
