import { requestNow } from "@/lib/time";
import { CheckCircle2, MessageCircleQuestion, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { FilterTabs, Pagination, PendingResults, QueryNav, SearchField } from "@/components/query-nav";
import { QuestionListSkeleton } from "@/components/skeletons";
import { Chip, Container, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { getViewer } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { QUESTION } from "@/lib/queries";
import type { Question } from "@/lib/types";

export const metadata: Metadata = { title: "Commuter Q&A" };

const PAGE_SIZE = 20;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function QuestionsPage({ searchParams }: PageProps<"/questions">) {
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 100);
  const tab = one(sp.tab);
  const page = Math.max(1, Number.parseInt(one(sp.page) || "1", 10) || 1);
  const [{ t, lang }, { supabase }] = await Promise.all([getI18n(), getViewer()]);

  let query = supabase.from("questions").select(QUESTION).eq("is_removed", false).neq("status", "merged");
  if (q) query = query.textSearch("search", q, { type: "websearch", config: "simple" });
  if (tab === "unanswered") query = query.eq("status", "open");
  else if (tab === "answered") query = query.eq("status", "answered");
  else if (tab === "resolved") query = query.not("best_answer_id", "is", null);
  const { data } = await query.order("last_activity_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rows = (data ?? []) as unknown as Question[];
  const hasNext = rows.length > PAGE_SIZE;
  const questions = rows.slice(0, PAGE_SIZE);
  const now = await requestNow();

  return (
    <I18nProvider lang={lang}>
      <LiveRefresh tables={[{ table: "questions" }]} />
      <Container className="max-w-4xl">
        <PageHeader
          title={t("qa.title")}
          subtitle={t("qa.subtitle")}
          actions={
            <LinkButton href="/questions/ask" variant="primary">
              <MessageCircleQuestion className="size-4" aria-hidden /> {t("qa.ask")}
            </LinkButton>
          }
        />
        <QueryNav>
          <div className="space-y-3">
            <SearchField placeholder={t("qa.searchPlaceholder")} label={t("common.search")} />
            <FilterTabs
              param="tab"
              label="Filter questions"
              options={[
                { value: "", label: t("qa.all") },
                { value: "unanswered", label: t("qa.unanswered") },
                { value: "answered", label: t("qa.answered") },
                { value: "resolved", label: t("qa.resolved") },
              ]}
            />
          </div>
          <div className="mt-4">
            <PendingResults fallback={<QuestionListSkeleton rows={8} />}>
              {questions.length ? (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                  {questions.map((question) => (
                    <li key={question.id}>
                      <Link href={`/questions/${question.id}`} prefetch className="flex gap-3 px-4 py-3.5 hover:bg-slate-50">
                        <div
                          className={`grid size-11 shrink-0 place-items-center rounded-xl text-center text-xs font-bold ${
                            question.best_answer_id
                              ? "bg-emerald-100 text-emerald-800"
                              : question.answer_count
                                ? "bg-brand-50 text-brand-700"
                                : "bg-slate-100 text-slate-500"
                          }`}
                          title={t("qa.answers", { n: question.answer_count })}
                        >
                          {question.best_answer_id ? <CheckCircle2 className="size-5" aria-hidden /> : question.answer_count}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">{question.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            {question.origin_text && question.destination_text ? (
                              <Chip>
                                {question.origin_text} → {question.destination_text}
                              </Chip>
                            ) : null}
                            <span>{question.answer_count ? t("qa.answers", { n: question.answer_count }) : t("qa.noAnswers")}</span>
                            <span>· {question.author?.display_name ?? t("common.deletedUser")}</span>
                            <span>· {timeAgo(question.last_activity_at, now, lang)}</span>
                            {question.status === "closed" ? <Chip tone="rose">Closed</Chip> : null}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<MessagesSquare className="size-8" />}
                  title={q ? t("qa.emptySearch") : t("qa.empty")}
                  action={
                    <LinkButton href={q ? `/questions/ask?title=${encodeURIComponent(q)}` : "/questions/ask"} variant="primary">
                      {t("qa.ask")}
                    </LinkButton>
                  }
                />
              )}
              <Pagination page={page} hasNext={hasNext} />
            </PendingResults>
          </div>
        </QueryNav>
      </Container>
    </I18nProvider>
  );
}
