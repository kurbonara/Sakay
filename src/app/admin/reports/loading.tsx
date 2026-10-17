import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function ReportsLoading() {
  return (
    <Container className="space-y-4" aria-busy="true">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-20 w-full" />
        </Card>
      ))}
    </Container>
  );
}
