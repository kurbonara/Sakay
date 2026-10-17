import { QuestionListSkeleton } from "@/components/skeletons";
import { Container, Skeleton } from "@/components/ui/primitives";

export default function AuditLoading() {
  return (
    <Container className="space-y-4" aria-busy="true">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-4 w-80" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-36 rounded-full" />
      </div>
      <QuestionListSkeleton rows={10} />
    </Container>
  );
}
