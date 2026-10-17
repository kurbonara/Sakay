import { Card, Container, PageHeaderSkeleton, Skeleton } from "@/components/ui/primitives";

export function QuestionListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 px-4 py-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ListPageSkeleton({ tabs = 4, rows = 6, withActions = true }: { tabs?: number; rows?: number; withActions?: boolean }) {
  return (
    <Container aria-busy="true">
      <PageHeaderSkeleton withActions={withActions} />
      <Skeleton className="mb-3 h-11 w-full" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: tabs }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <QuestionListSkeleton rows={rows} />
    </Container>
  );
}

export function DetailSkeleton({ withMap = true }: { withMap?: boolean }) {
  return (
    <Container aria-busy="true" className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </Card>
          <Card className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
          </Card>
        </div>
        {withMap ? <Skeleton className="h-72 w-full rounded-2xl lg:h-[420px]" /> : null}
      </div>
    </Container>
  );
}

export function FormPageSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Container className="max-w-2xl" aria-busy="true">
      <PageHeaderSkeleton />
      <Card className="space-y-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-36" />
      </Card>
    </Container>
  );
}
