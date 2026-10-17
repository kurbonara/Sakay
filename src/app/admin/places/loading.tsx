import { QuestionListSkeleton } from "@/components/skeletons";
import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function AdminPlacesLoading() {
  return (
    <Container className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-11 w-full" />
          <QuestionListSkeleton rows={8} />
        </div>
        <Card className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-11 w-full" />
        </Card>
      </div>
    </Container>
  );
}
