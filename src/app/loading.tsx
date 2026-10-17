import { RouteGridSkeleton } from "@/components/route-bits";
import { Container, Skeleton } from "@/components/ui/primitives";
import { QuestionListSkeleton } from "@/components/skeletons";

export default function HomeLoading() {
  return (
    <Container className="space-y-8" aria-busy="true">
      <section className="rounded-3xl bg-brand-600 p-5 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="space-y-3">
            <Skeleton className="h-5 w-56 bg-white/20" />
            <Skeleton className="h-10 w-72 max-w-full bg-white/25" />
            <Skeleton className="h-4 w-96 max-w-full bg-white/20" />
          </div>
          <div className="space-y-3 rounded-2xl bg-white p-5">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </section>
      <Skeleton className="h-9 w-full max-w-lg rounded-full" />
      <div>
        <Skeleton className="mb-3 h-7 w-48" />
        <RouteGridSkeleton count={6} />
      </div>
      <QuestionListSkeleton />
    </Container>
  );
}
