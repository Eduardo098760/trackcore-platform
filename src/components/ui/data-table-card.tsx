import { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type DataTableCardProps = {
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyState?: ReactNode;
  loadingRows?: number;
  withCard?: boolean;
  cardClassName?: string;
  contentClassName?: string;
  loadingClassName?: string;
  skeletonClassName?: string;
};

export function DataTableCard({
  children,
  isLoading = false,
  isEmpty = false,
  emptyState = null,
  loadingRows = 5,
  withCard = true,
  cardClassName,
  contentClassName,
  loadingClassName,
  skeletonClassName,
}: DataTableCardProps) {
  const content = isLoading ? (
    <div className={cn("space-y-3", loadingClassName)}>
      {Array.from({ length: loadingRows }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-12 w-full", skeletonClassName)}
        />
      ))}
    </div>
  ) : isEmpty ? (
    emptyState
  ) : (
    children
  );

  if (!withCard) {
    return <div className={contentClassName}>{content}</div>;
  }

  return (
    <Card className={cardClassName}>
      <CardContent className={contentClassName}>{content}</CardContent>
    </Card>
  );
}