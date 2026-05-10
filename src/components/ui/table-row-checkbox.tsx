"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTableSelection } from "@/components/ui/table-selection-context";

interface Props {
  id: number;
}

export const TableRowCheckbox: React.FC<Props> = ({ id }) => {
  const { selectedIds, toggle } = useTableSelection();
  return (
    <Checkbox
      checked={selectedIds.has(id)}
      onCheckedChange={() => toggle(id)}
    />
  );
};

export default TableRowCheckbox;
