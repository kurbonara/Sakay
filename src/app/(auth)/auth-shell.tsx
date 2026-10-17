import type { ReactNode } from "react";
import { Card, Container, Skeleton } from "@/components/ui/primitives";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Container className="max-w-md">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </Card>
      {footer ? <div className="mt-4 text-center text-sm text-slate-600">{footer}</div> : null}
    </Container>
  );
}

export function AuthSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <Container className="max-w-md" aria-busy="true">
      <Card className="space-y-5 p-6 sm:p-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-12 w-full" />
      </Card>
    </Container>
  );
}
