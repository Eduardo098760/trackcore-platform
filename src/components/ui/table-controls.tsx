"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";

interface ColumnDef {
  header: string;
  key: string;
}

interface TableControlsProps {
  data: any[];
  columns?: ColumnDef[];
  allSelected?: boolean;
  onSelectAll?: (checked: boolean) => void;
  filenamePrefix?: string;
  requireSelection?: boolean;
  selectedCount?: number;
}

export const TableControls: React.FC<TableControlsProps> = ({
  data,
  columns,
  allSelected = false,
  onSelectAll,
  filenamePrefix = "export",
  requireSelection = false,
  selectedCount,
}) => {
  const handleExportExcel = () => {
    exportToExcel(data, `${filenamePrefix}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!columns) {
      // try to derive columns from first row
      const keys = data.length > 0 ? Object.keys(data[0]) : [];
      const derived = keys.map((k) => ({ header: k, key: k }));
      exportToPDF(data, derived, `${filenamePrefix}.pdf`);
    } else {
      exportToPDF(data, columns, `${filenamePrefix}.pdf`);
    }
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {onSelectAll && (
          <label className="inline-flex items-center gap-2">
            <Checkbox checked={allSelected} onCheckedChange={(v) => onSelectAll(!!v)} />
            <span className="text-sm text-muted-foreground">Selecionar todos</span>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2">
        {(() => {
          const hasSelection = (selectedCount ?? data.length) > 0;
          const canExport = data.length > 0 && (!requireSelection || hasSelection);
          return (
            <>
              <Button variant="outline" onClick={handleExportExcel} className="text-sm" disabled={!canExport}>
                Exportar XLSX
              </Button>
              <Button variant="outline" onClick={handleExportPDF} className="text-sm" disabled={!canExport}>
                Exportar PDF
              </Button>
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default TableControls;
