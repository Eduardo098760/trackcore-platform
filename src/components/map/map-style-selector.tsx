"use client";

import { Card } from "@/components/ui/card";
import { TILE_LAYERS, type TileLayerKey } from "@/components/map/map-constants";

interface MapStyleSelectorProps {
  mapStyle: TileLayerKey;
  onStyleChange: (style: TileLayerKey) => void;
}

export function MapStyleSelector({
  mapStyle,
  onStyleChange,
}: MapStyleSelectorProps) {
  return (
    <Card className="backdrop-blur-xl bg-black/40 dark:bg-black/60 border-white/10 shadow-lg overflow-hidden">
      <div className="flex rounded-lg overflow-hidden">
        {(["dark", "light", "streets", "satellite"] as const).map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => onStyleChange(style)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              mapStyle === style
                ? "bg-primary text-primary-foreground"
                : "bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            {TILE_LAYERS[style].label}
          </button>
        ))}
      </div>
    </Card>
  );
}
