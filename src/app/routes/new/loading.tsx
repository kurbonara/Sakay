import { Card, Container, PageHeaderSkeleton, Skeleton } from "@/components/ui/primitives";

export default function NewRouteLoading() {
  return (
    <Container className="max-w-3xl space-y-5" aria-busy="true">
      <PageHeaderSkeleton />
      <Card className="space-y-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
      <Skeleton className="h-6 w-48" />
      <Card className="space-y-3">
        <Skeleton className="h-5 w-20" />
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
      </Card>
    </Container>
  );
}
