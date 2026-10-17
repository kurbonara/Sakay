import { QuestionListSkeleton } from "@/components/skeletons";
import { Container, Skeleton } from "@/components/ui/primitives";

export default function AdminQuestionsLoading() {
  return (
    <Container className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-36" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <QuestionListSkeleton rows={6} />
    </Container>
  );
}
