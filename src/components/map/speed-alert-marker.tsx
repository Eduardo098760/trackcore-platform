"use client";

import { SpeedAlert } from "@/types";
import dynamic from "next/dynamic";

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);

const LeafletPopup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false },
);

let L: any;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

interface SpeedAlertMarkerProps {
  alert: SpeedAlert;
}

export function SpeedAlertMarker({ alert }: SpeedAlertMarkerProps) {
  const { useMap } = require("react-leaflet");
  const map = useMap();
  if (!L) return null;

  return (
    <Marker
      position={[alert.latitude, alert.longitude]}
      icon={L.divIcon({
        className: "speed-alert-icon",
        html: `<div style="
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border: 2.5px solid #fff;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          box-shadow: 0 0 0 3px rgba(245,158,11,0.35), 0 3px 10px rgba(0,0,0,0.7);
        ">&#x26A1;</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })}
    >
      <LeafletPopup minWidth={270} maxWidth={270} closeButton={false}>
        <div
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
              borderLeft: "3px solid #f59e0b",
              padding: "9px 10px 9px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fbbf24",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                Excesso de Velocidade
              </span>
            </div>
            <button
              onClick={() => {
                try {
                  map.closePopup();
                } catch {
                  /* ignore */
                }
              }}
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
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#4b5563";
              }}
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
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  lineHeight: 1.3,
                }}
              >
                {alert.vehicleName || alert.deviceName}
              </div>
              {alert.vehicleName && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#4b5563",
                    marginTop: 2,
                    fontFamily: "monospace",
                    letterSpacing: 0.5,
                  }}
                >
                  {alert.deviceName}
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid #1a2335" }} />

            {/* Velocidades lado a lado */}
            <div style={{ display: "flex", gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  background: "#0d1117",
                  borderRadius: 8,
                  padding: "8px 10px",
                  border: "1px solid #1a2535",
                  borderTop: "2px solid #f59e0b",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 4,
                  }}
                >
                  Registrado
                </div>
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 3 }}
                >
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: "#fbbf24",
                      lineHeight: 1,
                    }}
                  >
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
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 4,
                  }}
                >
                  Limite
                </div>
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 3 }}
                >
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: "#94a3b8",
                      lineHeight: 1,
                    }}
                  >
                    {alert.speedLimit > 0 ? Math.round(alert.speedLimit) : "—"}
                  </span>
                  {alert.speedLimit > 0 && (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>km/h</span>
                  )}
                </div>
              </div>
            </div>

            {/* Badge de excesso */}
            {alert.speedLimit > 0 && (
              <div
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.22)",
                  borderRadius: 6,
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  Ultrapassou o limite em
                </span>
                <span
                  style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}
                >
                  +{Math.max(0, Math.round(alert.speed - alert.speedLimit))}{" "}
                  km/h
                </span>
              </div>
            )}

            {/* Data e hora */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#374151"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: 11, color: "#4b5563" }}>
                {new Date(alert.timestamp).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      </LeafletPopup>
    </Marker>
  );
}
