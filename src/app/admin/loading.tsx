import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function AdminLoading() {
  return (
    <Container className="space-y-6" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ))}
      </div>
    </Container>
  );
}
