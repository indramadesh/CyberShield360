import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "./card";
import { Skeleton } from "./skeleton";

/** Empty state: explains what's missing and what to do next. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Inline error state with an optional retry. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 text-danger" />
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
            {onRetry && (
              <button onClick={onRetry} className="mt-3 text-sm font-medium text-primary hover:underline">
                Try again
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** A few stacked skeleton rows for list/card loading. */
export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-5">
        <Skeleton className="h-4 w-1/3 mb-3" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-2/3" />
      </CardContent>
    </Card>
  );
}
