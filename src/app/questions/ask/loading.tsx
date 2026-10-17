import { Card, Container, PageHeaderSkeleton, Skeleton } from "@/components/ui/primitives";

export default function AskLoading() {
  return (
    <Container aria-busy="true">
      <PageHeaderSkeleton />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-36" />
        </Card>
        <Card className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      </div>
    </Container>
  );
}
