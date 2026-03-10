"use client";

import { useState, useRef, useEffect } from "react";
import { TILE_LAYERS, type TileLayerKey } from "@/components/map/map-constants";
import { Map, Check, ChevronDown } from "lucide-react";

interface MapStyleSelectorProps {
  mapStyle: TileLayerKey;
  onStyleChange: (style: TileLayerKey) => void;
}

const STYLE_GROUPS: { label: string; styles: TileLayerKey[] }[] = [
  { label: "Carto", styles: ["dark", "light", "streets", "satellite"] },
  { label: "Google", styles: ["googleRoads", "googleSatellite", "googleHybrid"] },
];

export function MapStyleSelector({
  mapStyle,
  onStyleChange,
}: MapStyleSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 xl:gap-2 px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-lg text-[11px] xl:text-xs font-semibold transition-all shadow-lg backdrop-blur-xl border bg-black/50 border-white/10 text-white hover:bg-white/10"
        title="Estilo do mapa"
      >
        <Map className="w-4 h-4" />
        <span>{TILE_LAYERS[mapStyle].label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 min-w-[180px] rounded-lg border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl z-[9999] py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {STYLE_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="my-1 border-t border-white/10" />}
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {group.label}
              </div>
              {group.styles.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => {
                    onStyleChange(style);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors ${
                    mapStyle === style
                      ? "bg-primary/20 text-primary font-semibold"
                      : "text-gray-300 hover:bg-white/10"
                  }`}
                >
                  <Check
                    className={`w-3.5 h-3.5 flex-shrink-0 ${mapStyle === style ? "opacity-100" : "opacity-0"}`}
                  />
                  {TILE_LAYERS[style].label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
