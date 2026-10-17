import { QuestionListSkeleton } from "@/components/skeletons";
import { Container, PageHeaderSkeleton, Skeleton } from "@/components/ui/primitives";

export default function QuestionsLoading() {
  return (
    <Container className="max-w-4xl" aria-busy="true">
      <PageHeaderSkeleton withActions />
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      </div>
      <div className="mt-4">
        <QuestionListSkeleton rows={8} />
      </div>
    </Container>
  );
}
