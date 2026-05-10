import { ReactNode, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import TableControls from "@/components/ui/table-controls";
import { TableSelectionContext } from "@/components/ui/table-selection-context";

type ExportColumn = { header: string; key: string };

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
  exportData?: any[];
  exportColumns?: ExportColumn[];
  filenamePrefix?: string;
  requireSelectionForExport?: boolean;
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
  exportData,
  exportColumns,
  filenamePrefix = "export",
  requireSelectionForExport = false,
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

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (checked: boolean) => {
    if (!exportData) return;
    if (checked) setSelectedIds(new Set(exportData.map((d) => d.id)));
    else setSelectedIds(new Set());
  };

  const ctxValue = useMemo(() => ({ selectedIds, toggle, selectAll }), [selectedIds]);

  const controls = exportData ? (
    <TableControls
      data={
        requireSelectionForExport
          ? (selectedIds.size > 0 ? exportData.filter((d) => selectedIds.has(d.id)) : [])
          : (selectedIds.size > 0 ? exportData.filter((d) => selectedIds.has(d.id)) : exportData)
      }
      columns={exportColumns}
      allSelected={exportData.length > 0 && selectedIds.size === exportData.length}
      onSelectAll={selectAll}
      filenamePrefix={filenamePrefix}
      requireSelection={requireSelectionForExport}
      selectedCount={selectedIds.size}
    />
  ) : null;

  const wrapped = (
    <TableSelectionContext.Provider value={ctxValue}>
      {controls}
      {content}
    </TableSelectionContext.Provider>
  );

  if (!withCard) {
    return <div className={contentClassName}>{wrapped}</div>;
  }

  return (
    <Card className={cardClassName}>
      <CardContent className={contentClassName}>{wrapped}</CardContent>
    </Card>
  );
}