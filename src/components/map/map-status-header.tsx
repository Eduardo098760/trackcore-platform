"use client";

import { Card } from "@/components/ui/card";
import { Wifi, WifiOff } from "lucide-react";

interface MapStatusHeaderProps {
  isWsConnected: boolean;
  deviceCount: number;
  selectedDevice: boolean;
}

export function MapStatusHeader({
  isWsConnected,
  deviceCount,
  selectedDevice,
}: MapStatusHeaderProps) {
  return (
    <div
      className={`absolute top-3 z-[1000] flex items-center gap-2 transition-all ${
        selectedDevice ? "right-[328px]" : "right-3"
      }`}
    >
      <Card className="backdrop-blur-xl bg-black/40 dark:bg-black/60 border-white/10 shadow-lg">
        <div className="px-3 py-1.5 flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            {isWsConnected ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-400">Real-time</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-orange-500" />
                <span className="text-xs text-orange-400">Polling</span>
              </>
            )}
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-200">Movimento</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs text-gray-200">Parado</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 bg-gray-500 rounded-full" />
            <span className="text-xs text-gray-200">Offline</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <span className="text-xs text-blue-400 font-medium">
            {deviceCount} veículos
          </span>
        </div>
      </Card>
    </div>
  );
}
