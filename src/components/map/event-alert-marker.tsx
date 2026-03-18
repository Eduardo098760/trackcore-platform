"use client";

import React from "react";
import ReactDOMServer from "react-dom/server";
import { EventAlert } from "@/types";
import dynamic from "next/dynamic";
import {
  Zap,
  MapPin,
  LogOut,
  AlertTriangle,
  Power,
  Lock,
  Pause,
  Navigation,
  Wrench,
  Bell,
  Crosshair,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);

const LeafletPopup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false },
);

const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false },
);

let L: any;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

// Mapa de ícones Lucide por tipo de evento
const EVENT_ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  mapPin: MapPin,
  logOut: LogOut,
  alertTriangle: AlertTriangle,
  power: Power,
  lock: Lock,
  pause: Pause,
  navigation: Navigation,
  wrench: Wrench,
  bell: Bell,
  crosshair: Crosshair,
};

// Renderiza ícone Lucide como HTML string para uso no divIcon do Leaflet
function renderIconHtml(iconKey: string, color: string, size: number): string {
  const Icon = EVENT_ICONS[iconKey] || Bell;
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(Icon, { size, color, strokeWidth: 2.5 })
  );
}

// Cores e ícones por tipo de evento
function getEventStyle(eventType: string): { color: string; gradient: string; iconKey: string } {
  switch (eventType) {
    case "speedLimit":
    case "deviceOverspeed":
      return { color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", iconKey: "zap" };
    case "geofenceEnter":
      return { color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", iconKey: "mapPin" };
    case "geofenceExit":
      return { color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", iconKey: "logOut" };
    case "deviceAlarm":
    case "alarm":
      return { color: "#ef4444", gradient: "linear-gradient(135deg, #ef4444, #dc2626)", iconKey: "alertTriangle" };
    case "ignitionOn":
      return { color: "#22c55e", gradient: "linear-gradient(135deg, #22c55e, #16a34a)", iconKey: "power" };
    case "ignitionOff":
      return { color: "#6b7280", gradient: "linear-gradient(135deg, #6b7280, #4b5563)", iconKey: "lock" };
    case "deviceStopped":
      return { color: "#f97316", gradient: "linear-gradient(135deg, #f97316, #ea580c)", iconKey: "pause" };
    case "deviceMoving":
      return { color: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)", iconKey: "navigation" };
    case "maintenance":
      return { color: "#eab308", gradient: "linear-gradient(135deg, #eab308, #ca8a04)", iconKey: "wrench" };
    default:
      return { color: "#64748b", gradient: "linear-gradient(135deg, #64748b, #475569)", iconKey: "bell" };
  }
}

interface EventAlertMarkerProps {
  alert: EventAlert;
}

export function EventAlertMarker({ alert }: EventAlertMarkerProps) {
  const { useMap } = require("react-leaflet");
  const map = useMap();
  if (!L) return null;

  const style = getEventStyle(alert.eventType);
  const hasCurrentPos = alert.currentLatitude != null && alert.currentLongitude != null;
  const hasBothPositions = hasCurrentPos &&
    (alert.currentLatitude !== alert.latitude || alert.currentLongitude !== alert.longitude);

  const isSpeedEvent = alert.eventType === "speedLimit" || alert.eventType === "deviceOverspeed";

  const alertIcon = L.divIcon({
    className: "event-alert-icon",
    html: `<div style="
      background: ${style.gradient};
      border: 2.5px solid #fff;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 0 3px ${style.color}55, 0 3px 10px rgba(0,0,0,0.7);
    ">${renderIconHtml(style.iconKey, '#fff', 16)}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const currentIcon = hasBothPositions
    ? L.divIcon({
        className: "event-current-icon",
        html: `<div style="
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border: 2px solid #fff;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.35), 0 2px 8px rgba(0,0,0,0.5);
        ">${renderIconHtml('crosshair', '#fff', 13)}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    : null;

  const formattedDate = new Date(alert.timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      {/* Linha conectando posição do alerta à posição atual */}
      {hasBothPositions && (
        <Polyline
          positions={[
            [alert.latitude, alert.longitude],
            [alert.currentLatitude!, alert.currentLongitude!],
          ]}
          pathOptions={{
            color: style.color,
            weight: 2,
            opacity: 0.6,
            dashArray: "6, 8",
          }}
        />
      )}

      {/* Marcador da posição atual do veículo */}
      {hasBothPositions && currentIcon && (
        <Marker
          position={[alert.currentLatitude!, alert.currentLongitude!]}
          icon={currentIcon}
        >
          <LeafletPopup minWidth={200} maxWidth={200} closeButton={false}>
            <div
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                background: "#111827",
                borderRadius: 10,
                overflow: "hidden",
                margin: "-14px -20px",
                width: 200,
                border: "1px solid #1a2535",
              }}
            >
              <div
                style={{
                  background: "#0d1117",
                  borderLeft: "3px solid #22c55e",
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", letterSpacing: 0.8, textTransform: "uppercase" }}>
                  Posição Atual
                </span>
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                  {alert.vehicleName || alert.deviceName}
                </div>
                {alert.vehicleName && (
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2, fontFamily: "monospace" }}>
                    {alert.deviceName}
                  </div>
                )}
              </div>
            </div>
          </LeafletPopup>
        </Marker>
      )}

      {/* Marcador principal — posição do evento/alerta */}
      <Marker position={[alert.latitude, alert.longitude]} icon={alertIcon}>
        <LeafletPopup minWidth={270} maxWidth={270} closeButton={false}>
          <div
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              background: "#111827",
              borderRadius: 12,
              overflow: "hidden",
              margin: "-14px -20px",
              width: 270,
              border: "1px solid #1a2535",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "#0d1117",
                borderLeft: `3px solid ${style.color}`,
                padding: "9px 10px 9px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {React.createElement(EVENT_ICONS[style.iconKey] || Bell, { size: 14, color: style.color, strokeWidth: 2.5 })}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: style.color,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  {alert.label}
                </span>
              </div>
              <button
                onClick={() => { try { map.closePopup(); } catch {} }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#4b5563",
                  fontSize: 20,
                  lineHeight: 1,
                  padding: "0 4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#4b5563"; }}
                title="Fechar"
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "12px 14px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* Nome do veículo + placa */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.3 }}>
                  {alert.vehicleName || alert.deviceName}
                </div>
                {alert.vehicleName && (
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2, fontFamily: "monospace", letterSpacing: 0.5 }}>
                    {alert.deviceName}
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid #1a2335" }} />

              {/* Velocidades — só para eventos de velocidade */}
              {isSpeedEvent && alert.speed != null && (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        background: "#0d1117",
                        borderRadius: 8,
                        padding: "8px 10px",
                        border: "1px solid #1a2535",
                        borderTop: `2px solid ${style.color}`,
                      }}
                    >
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
                        Registrado
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                        <span style={{ fontSize: 26, fontWeight: 800, color: style.color, lineHeight: 1 }}>
                          {alert.speed}
                        </span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>km/h</span>
                      </div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: "#0d1117",
                        borderRadius: 8,
                        padding: "8px 10px",
                        border: "1px solid #1a2535",
                        borderTop: "2px solid #2d3a4a",
                      }}
                    >
                      <div style={{ fontSize: 9, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
                        Limite
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                        <span style={{ fontSize: 26, fontWeight: 800, color: "#94a3b8", lineHeight: 1 }}>
                          {alert.speedLimit && alert.speedLimit > 0 ? Math.round(alert.speedLimit) : "—"}
                        </span>
                        {alert.speedLimit != null && alert.speedLimit > 0 && (
                          <span style={{ fontSize: 11, color: "#6b7280" }}>km/h</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {alert.speedLimit != null && alert.speedLimit > 0 && (
                    <div
                      style={{
                        background: `${style.color}14`,
                        border: `1px solid ${style.color}38`,
                        borderRadius: 6,
                        padding: "6px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#6b7280" }}>Ultrapassou o limite em</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: style.color }}>
                        +{Math.max(0, Math.round(alert.speed - alert.speedLimit))} km/h
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Info do alarme */}
              {alert.alarm && (
                <div
                  style={{
                    background: "#0d1117",
                    borderRadius: 8,
                    padding: "8px 12px",
                    border: "1px solid #1a2535",
                    borderLeft: `3px solid ${style.color}`,
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>
                    Alarme
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                    {alert.alarm}
                  </div>
                </div>
              )}

              {/* Info de posição — se temos ambas as posições */}
              {hasBothPositions && (
                <div
                  style={{
                    background: "#0d1117",
                    borderRadius: 8,
                    padding: "8px 12px",
                    border: "1px solid #1a2535",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: style.color, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>Posição do alerta</div>
                  </div>
                  <span style={{ color: "#4b5563", fontSize: 16 }}>⋯</span>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#22c55e", flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>Posição atual</div>
                  </div>
                </div>
              )}

              {/* Data e hora */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: 11, color: "#4b5563" }}>
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>
        </LeafletPopup>
      </Marker>
    </>
  );
}
