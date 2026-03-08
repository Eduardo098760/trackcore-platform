export type TileLayerKey = "dark" | "light" | "streets" | "satellite" | "googleRoads" | "googleSatellite" | "googleHybrid";

export const TILE_LAYERS: Record<
  TileLayerKey,
  {
    url: string;
    attribution: string;
    label: string;
    subdomains?: string | string[];
    maxNativeZoom?: number;
  }
> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: "Escuro",
    subdomains: "abcd",
    maxNativeZoom: 18,
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: "Claro",
    subdomains: "abcd",
    maxNativeZoom: 18,
  },
  streets: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    label: "Ruas",
    subdomains: "abcd",
    maxNativeZoom: 18,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    label: "Satélite",
    maxNativeZoom: 18,
  },
  googleRoads: {
    url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: '&copy; Google Maps',
    label: "Google",
    subdomains: "0123",
    maxNativeZoom: 20,
  },
  googleSatellite: {
    url: "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: '&copy; Google Maps',
    label: "Google Sat.",
    subdomains: "0123",
    maxNativeZoom: 20,
  },
  googleHybrid: {
    url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: '&copy; Google Maps',
    label: "Google Híbrido",
    subdomains: "0123",
    maxNativeZoom: 20,
  },
};

export function getMarkerColor(status: string) {
  switch (status) {
    case "moving":
      return "#3b82f6";
    case "online":
    case "stopped":
      return "#10b981";
    case "offline":
      return "#6b7280";
    case "blocked":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}
