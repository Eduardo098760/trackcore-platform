"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, X, Car, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface VehicleOption {
  id: number;
  name?: string;
  plate?: string;
  uniqueId?: string;
}

interface BaseProps {
  /** Lista de veículos disponíveis */
  devices: VehicleOption[];
  /** Placeholder do botão quando nada selecionado */
  placeholder?: string;
  /** Classe extra no wrapper */
  className?: string;
  /** Desabilitar interação */
  disabled?: boolean;
  /** Posição do dropdown */
  align?: "left" | "right";
}

interface SingleSelectProps extends BaseProps {
  mode: "single";
  value: number | null;
  onChange: (id: number | null) => void;
}

interface MultiSelectProps extends BaseProps {
  mode: "multi";
  value: number[];
  onChange: (ids: number[]) => void;
}

export type VehicleComboboxProps = SingleSelectProps | MultiSelectProps;

/** Retorna label do device: placa > nome > uniqueId > id */
function deviceLabel(d: VehicleOption): string {
  return d.plate || d.name || d.uniqueId || `#${d.id}`;
}

function deviceSublabel(d: VehicleOption): string | null {
  if (d.plate && d.name) return d.name;
  if (d.name && d.uniqueId) return d.uniqueId;
  return null;
}

export function VehicleCombobox(props: VehicleComboboxProps) {
  const { devices, placeholder, className, disabled, align = "left", mode } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus on open
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return devices;
    const q = search.toLowerCase();
    return devices.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.plate?.toLowerCase().includes(q) ||
        d.uniqueId?.toLowerCase().includes(q),
    );
  }, [devices, search]);

  // Derived values
  const selectedIds = mode === "multi" ? props.value : props.value != null ? [props.value] : [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = useCallback(
    (id: number) => {
      if (mode === "multi") {
        const current = props.value as number[];
        if (current.includes(id)) {
          (props.onChange as (ids: number[]) => void)(current.filter((x) => x !== id));
        } else {
          (props.onChange as (ids: number[]) => void)([...current, id]);
        }
      } else {
        const current = props.value as number | null;
        if (current === id) {
          (props.onChange as (id: number | null) => void)(null);
        } else {
          (props.onChange as (id: number | null) => void)(id);
          setOpen(false);
          setSearch("");
        }
      }
    },
    [mode, props.value, props.onChange],
  );

  const clearAll = useCallback(() => {
    if (mode === "multi") {
      (props.onChange as (ids: number[]) => void)([]);
    } else {
      (props.onChange as (id: number | null) => void)(null);
    }
  }, [mode, props.onChange]);

  // Label
  const triggerLabel = useMemo(() => {
    if (selectedIds.length === 0) return placeholder || "Selecionar veículo";
    if (selectedIds.length === 1) {
      const d = devices.find((x) => x.id === selectedIds[0]);
      return d ? deviceLabel(d) : "1 veículo";
    }
    return `${selectedIds.length} veículos`;
  }, [selectedIds, devices, placeholder]);

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full min-h-[36px] px-3 py-1.5 text-sm rounded-md border border-input bg-background hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        <Car className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left truncate">{triggerLabel}</span>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
            className="shrink-0 hover:text-destructive"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Chips (multi-select) */}
      {mode === "multi" && selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedIds.map((id) => {
            const d = devices.find((x) => x.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium"
              >
                {d ? deviceLabel(d) : `#${id}`}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1 z-50 w-full min-w-[280px] rounded-lg border border-border bg-popover shadow-lg overflow-hidden`}
        >
          {/* Search */}
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="search"
                placeholder="Buscar por nome, placa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pl-8"
              />
            </div>
          </div>

          {/* Counter / clear */}
          {mode === "multi" && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/20">
              <span className="text-[11px] text-muted-foreground">
                {selectedIds.length === 0 ? "Nenhum selecionado" : `${selectedIds.length} selecionado(s)`}
              </span>
              <div className="flex gap-2">
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    (props.onChange as (ids: number[]) => void)(devices.map((d) => d.id));
                  }}
                  className="text-[10px] text-primary hover:underline"
                >
                  Todos
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.map((dev) => {
              const selected = selectedSet.has(dev.id);
              const sub = deviceSublabel(dev);
              return (
                <button
                  key={dev.id}
                  type="button"
                  onClick={() => toggle(dev.id)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-left border-b border-border/10 last:border-0 transition-colors text-xs ${
                    selected ? "bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <Car className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block truncate">{deviceLabel(dev)}</span>
                    {sub && (
                      <span className="text-[10px] text-muted-foreground block truncate">{sub}</span>
                    )}
                  </div>
                  {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum veículo encontrado
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
