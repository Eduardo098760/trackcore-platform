"use client";

import React from "react";

export type TableSelectionContextType = {
  selectedIds: Set<number>;
  toggle: (id: number) => void;
  selectAll: (checked: boolean) => void;
};

export const TableSelectionContext = React.createContext<TableSelectionContextType | null>(null);

export const useTableSelection = () => {
  const ctx = React.useContext(TableSelectionContext);
  if (!ctx) throw new Error("useTableSelection must be used within a TableSelectionContext");
  return ctx;
};
