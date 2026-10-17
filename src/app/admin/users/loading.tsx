import { Card, Container, Skeleton } from "@/components/ui/primitives";

export default function AdminUsersLoading() {
  return (
    <Container className="max-w-3xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-52" />
      <Card className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-4 w-80" />
      </Card>
    </Container>
  );
}
