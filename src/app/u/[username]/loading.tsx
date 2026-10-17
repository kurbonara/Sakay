import { RouteGridSkeleton } from "@/components/route-bits";
import { QuestionListSkeleton } from "@/components/skeletons";
import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function ProfileLoading() {
  return (
    <Container className="space-y-6" aria-busy="true">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-5 w-56 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3 sm:w-72">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </Card>
      <Skeleton className="h-6 w-48" />
      <RouteGridSkeleton count={3} />
      <div className="grid gap-6 lg:grid-cols-2">
        <QuestionListSkeleton rows={3} />
        <QuestionListSkeleton rows={3} />
      </div>
    </Container>
  );
}
