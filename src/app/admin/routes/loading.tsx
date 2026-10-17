import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function AdminRoutesLoading() {
  return (
    <Container className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-32" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-40" />
          </div>
        </Card>
      ))}
    </Container>
  );
}
