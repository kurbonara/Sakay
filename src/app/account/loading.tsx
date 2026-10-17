import { Card, Container, PageHeaderSkeleton, Skeleton } from "@/components/ui/primitives";

export default function AccountLoading() {
  return (
    <Container className="max-w-3xl space-y-6" aria-busy="true">
      <PageHeaderSkeleton withActions />
      <Card className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-64 rounded-full" />
      </Card>
      <Card className="space-y-4">
        <Skeleton className="h-5 w-20" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-20 w-full" />
      </Card>
      <Card className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    </Container>
  );
}
