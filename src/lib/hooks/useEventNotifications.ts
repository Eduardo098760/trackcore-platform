import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEvents, getDevices, getPositions, getPositionById } from "@/lib/api";
import { getGeofences } from "@/lib/api/geofences";
import { notificationManager } from "@/lib/notifications";
import { Device, Event, Geofence, Position, SpeedAlert } from "@/types";
import { parseWKT } from "@/lib/parse-wkt";
import { getEventDisplayLabel, normalizeEventType } from "@/lib/utils";

const EVENT_ALERT_TTL_MS = 5 * 60 * 1000;

/**
 * Hook que monitora eventos do Traccar e dispara notificações automaticamente
 */
// Tipos de evento que representam ESTADO (não ocorrência pontual).
// Para estes, só notificamos quando há uma TRANSIÇÃO real de estado por dispositivo.
const STATE_EVENT_TYPES = new Set([
  "deviceBlocked",
  "deviceUnblocked",
  "deviceOnline",
  "deviceOffline",
]);

export function useEventNotifications(enabled: boolean = true) {
  const processedEvents = useRef(new Set<number>());
  // Inicializa o último check para alguns minutos atrás (5 minutos + margem)
  // Assim o primeiro fetch processará eventos recentes e não será ignorado por
  // ter `serverTime` anterior ao momento de montagem do hook.
  const lastCheckTime = useRef<Date>(new Date(Date.now() - 6 * 60 * 1000));
  // Rastreia o último estado notificado por dispositivo para eventos de estado.
  // Ex: { 42: 'deviceBlocked' } → já notificamos que o device 42 está bloqueado.
  const deviceStateNotified = useRef<Map<number, string>>(new Map());
  const geofenceStateByDeviceRef = useRef<Map<string, boolean>>(new Map());

  // Buscar lista de dispositivos para resolver nome + placa
  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ["devices"],
    queryFn: () => getDevices(),
    enabled,
    staleTime: 60000, // Revalidar a cada 1 min
  });

  // Buscar eventos recentes a cada 5 segundos
  const { data: events = [] } = useQuery({
    queryKey: ["events", "recent"],
    queryFn: async () => {
      const now = new Date();
      const from = new Date(now.getTime() - 5 * 60 * 1000); // Últimos 5 minutos

      try {
        const events = await getEvents({
          from: from.toISOString(),
          to: now.toISOString(),
        });
        return events || [];
      } catch (error) {
        console.error("Erro ao buscar eventos:", error);
        return [];
      }
    },
    enabled,
    refetchInterval: 30_000, // Verificar a cada 30 segundos
    refetchOnWindowFocus: false,
  });

  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ["positions", "recent-for-notifications"],
    queryFn: () => getPositions(),
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: geofences = [] } = useQuery<Geofence[]>({
    queryKey: ["geofences", "recent-for-notifications"],
    queryFn: () => getGeofences(),
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!events || events.length === 0) return;

    // Filtrar apenas eventos novos (não processados).
    // OBS: não filtrar por `serverTime` aqui porque alguns eventos
    // podem chegar com timestamp anterior ao `lastCheckTime` (retransmissões
    // ou relógio do rastreador). Confiamos em `processedEvents` para evitar
    // duplicatas em memória.
    const newEvents = events.filter((event) => {
      if (processedEvents.current.has(event.id)) return false;
      return true;
    });

    if (newEvents.length === 0) return;

    console.log(`📊 ${newEvents.length} novo(s) evento(s) detectado(s) via HTTP`);

    // Processar eventos um por vez com pequeno delay para evitar empilhamento
    newEvents.forEach((event, index) => {
      setTimeout(async () => {
        // Para eventos de estado, verificar se já notificamos esse estado
        if (STATE_EVENT_TYPES.has(event.type)) {
          const lastState = deviceStateNotified.current.get(event.deviceId);
          if (lastState === event.type) {
            // Já notificamos esse exato estado — ignorar repetição
            processedEvents.current.add(event.id);
            return;
          }
          deviceStateNotified.current.set(event.deviceId, event.type);
        }
        await processEvent(event, devices);
        processedEvents.current.add(event.id);
      }, index * 500); // 500ms entre cada notificação
    });

    // Atualizar tempo do último check
    lastCheckTime.current = new Date();

    // Limpar eventos processados antigos (manter apenas últimos 200)
    if (processedEvents.current.size > 200) {
      const eventsArray = Array.from(processedEvents.current);
      processedEvents.current = new Set(eventsArray.slice(-200));
    }
  }, [events, devices]);

  // Detector local de transição em cerca: cobre o caso em que o evento do Traccar
  // não chega ou chega sem o subtipo correto.
  useEffect(() => {
    if (!enabled || positions.length === 0 || geofences.length === 0 || devices.length === 0) return;

    const positionByDeviceId = new Map(positions.map((position) => [position.deviceId, position]));
    const deviceIdSet = new Set(devices.map((device) => device.id));

    const syntheticEvents: Event[] = [];

    for (const geofence of geofences) {
      if (geofence.active === false) continue;

      const linkedDeviceIds = getLinkedDeviceIdsForGeofence(geofence, deviceIdSet);
      if (linkedDeviceIds.length === 0) continue;

      for (const deviceId of linkedDeviceIds) {
        const position = positionByDeviceId.get(deviceId);
        if (!position) continue;

        const isInside = isPositionInsideGeofence(position, geofence);
        const stateKey = `${deviceId}:${geofence.id}`;
        const previousState = geofenceStateByDeviceRef.current.get(stateKey);

        geofenceStateByDeviceRef.current.set(stateKey, isInside);

        if (previousState === undefined || previousState === isInside) continue;

        syntheticEvents.push({
          id: -Math.abs(Date.now() + deviceId * 1000 + geofence.id),
          type: isInside ? "geofenceEnter" : "geofenceExit",
          deviceId,
          positionId: position.id,
          address: position.address,
          serverTime: position.serverTime || position.fixTime || new Date().toISOString(),
          attributes: {
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            geofence: geofence.name,
            originalType: "geofence",
          },
          resolved: false,
        });
      }
    }

    if (syntheticEvents.length === 0) return;

    syntheticEvents.forEach((event) => {
      void processEvent(event, devices);
    });
  }, [enabled, positions, geofences, devices]);

  // ── WebSocket real-time: processar eventos imediatamente ──
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: globalThis.Event) => {
      const event = (e as CustomEvent).detail as Event;
      if (!event?.id || processedEvents.current.has(event.id)) return;

      console.log("⚡ Evento recebido via WebSocket:", event.type, event.id);
      processedEvents.current.add(event.id);

      // Para eventos de estado, verificar se já notificamos esse estado
      if (STATE_EVENT_TYPES.has(event.type)) {
        const lastState = deviceStateNotified.current.get(event.deviceId);
        if (lastState === event.type) {
          console.debug(
            `[WS] Estado "${event.type}" já notificado para device #${event.deviceId} — ignorado`,
          );
          return;
        }
        deviceStateNotified.current.set(event.deviceId, event.type);
      }
      processEvent(event, devices);

      // Limitar tamanho do set
      if (processedEvents.current.size > 200) {
        const arr = Array.from(processedEvents.current);
        processedEvents.current = new Set(arr.slice(-200));
      }
    };

    window.addEventListener("traccar-ws-event", handler);
    return () => window.removeEventListener("traccar-ws-event", handler);
  }, [enabled, devices]);

  return { events };
}

/**
 * Processa um evento e cria notificação apropriada
 */
async function processEvent(event: Event, devices: Device[] = []) {
  console.log("📢 Processando evento:", event);

  // Resolver nome e placa a partir da lista de devices
  const matchedDevice = devices.find((d) => d.id === event.deviceId);
  const vehicleName = matchedDevice?.name || event.attributes?.deviceName || undefined;
  const deviceName =
    matchedDevice?.plate ||
    matchedDevice?.uniqueId ||
    event.attributes?.deviceName ||
    `Veículo #${event.deviceId}`;
  const displayName = vehicleName || deviceName;

  let latitude: number | undefined;
  let longitude: number | undefined;
  let speedAlertId: string | undefined;

  // ──────────────────────────────────────────────────────────────────────────
  // EXCESSO DE VELOCIDADE: sempre salvar marcador no mapa, independente de
  // configurações de notificação, para o mapa exibir o ⚡ corretamente.
  // ──────────────────────────────────────────────────────────────────────────
  if (event.type === "deviceOverspeed" || event.type === "speedLimit") {
    try {
      const positions = await getPositions({ deviceId: event.deviceId });
      const position = positions?.[0];
      if (position) {
        latitude = position.latitude;
        longitude = position.longitude;

        const speed = Math.round((event.attributes?.speed || 0) * 1.852 || position.speed || 0);
        // Prioriza o limite configurado pelo usuário (já em km/h).
        // event.attributes.speedLimit vem do Traccar em KNOTS → converte * 1.852 apenas como fallback.
        const rawEventLimit = event.attributes?.speedLimit || event.attributes?.limit || 0;
        const speedLimit =
          matchedDevice?.speedLimit || (rawEventLimit > 0 ? Math.round(rawEventLimit * 1.852) : 0);

        const alert: SpeedAlert = {
          id: `${Date.now()}-${event.id}`,
          deviceId: event.deviceId,
          deviceName,
          vehicleName,
          speed,
          speedLimit,
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: event.serverTime,
        };
        speedAlertId = alert.id;

        try {
          const stored = localStorage.getItem("speedAlerts");
          const alerts: SpeedAlert[] = stored ? JSON.parse(stored) : [];
          alerts.unshift(alert);
          localStorage.setItem("speedAlerts", JSON.stringify(alerts.slice(0, 100)));
          window.dispatchEvent(new CustomEvent("speedAlertAdded", { detail: alert }));
          console.log("⚡ SpeedAlert registrado:", alert);
        } catch (storageErr) {
          console.error("[SpeedAlert] Erro ao salvar no localStorage:", storageErr);
        }
      }
    } catch (e) {
      console.error("[SpeedAlert] Erro ao buscar posição:", e);
    }
  }

  // ── Notificação in-app: respeita o filtro de "Tipos de Eventos" ──
  const normalizedEventType = normalizeEventType(event);

  const eventTypeMap: Record<string, string> = {
    ignitionOn: "ignitionOn",
    ignitionOff: "ignitionOff",
    deviceOnline: "deviceOnline",
    deviceOffline: "deviceOffline",
    geofenceEnter: "geofenceEnter",
    geofenceExit: "geofenceExit",
    geofence: "geofenceEnter",
    alarm: "alarm",
    deviceOverspeed: "speedLimit",
    speedLimit: "speedLimit",
    maintenance: "maintenance",
    deviceMoving: "deviceMoving",
    deviceStopped: "deviceStopped",
    commandResult: "commandResult",
    textMessage: "textMessage",
    lowBattery: "lowBattery",
    driverChanged: "driverChanged",
    media: "media",
    deviceBlocked: "deviceBlocked",
    deviceUnblocked: "deviceUnblocked",
    fuelDrop: "fuelDrop",
    fuelIncrease: "fuelIncrease",
  };

  // Map to internal type, but treat `alarm` specially based on attributes
  let internalType = eventTypeMap[normalizedEventType] || normalizedEventType;
  if (normalizedEventType === "alarm") {
    const rawAlarm = event.attributes?.alarm || event.attributes?.alarmType || event.attributes?.subtype || event.attributes?.type;
    const alarmStr = rawAlarm != null ? String(rawAlarm).toLowerCase() : "";
    if (alarmStr === "sos" || alarmStr.includes("sos") || alarmStr === "panic" || alarmStr.includes("panic")) {
      internalType = "sos";
    } else {
      internalType = "alarm";
    }
  }

  // Valores padrão para todos os tipos de evento
  const DEFAULT_EVENTS: Record<string, boolean> = {
    speedLimit: true,
    geofenceEnter: true,
    geofenceExit: true,
    alarm: true,
    ignitionOn: false,
    ignitionOff: false,
    deviceOffline: true,
    deviceOnline: false,
    deviceMoving: false,
    deviceStopped: false,
    lowBattery: true,
    maintenance: true,
    sos: true,
    commandResult: true,
    textMessage: true,
    driverChanged: false,
    fuelDrop: true,
    fuelIncrease: false,
    deviceBlocked: false,
    deviceUnblocked: false,
    media: false,
  };

  // Verificar se o tipo de evento está habilitado nas configurações do usuário.
  // Mescla defaults com o que está salvo → tipos novos nunca "escapam" por falta de chave.
  try {
    const isGeofenceTransition = internalType === "geofenceEnter" || internalType === "geofenceExit";

    // Entrada e saída de cerca são eventos operacionais críticos.
    // Não passam pelos filtros de configuração por tipo/veículo para evitar
    // bloqueio acidental quando a cerca já está centralizada em outro contexto.
    if (!isGeofenceTransition) {
    const settingsStr = localStorage.getItem("notificationSettings");
    const saved = settingsStr ? JSON.parse(settingsStr) : {};
    const eventsConfig: Record<string, boolean> = { ...DEFAULT_EVENTS, ...(saved.events || {}) };

    // 1) Verificar regras POR VEÍCULO (vehicleNotifRulesV2 do painel de detalhes)
    const vehicleRulesStr = localStorage.getItem("vehicleNotifRulesV2");
    const vehicleRulesAll: Record<string, Array<{ eventType: string }>> = vehicleRulesStr
      ? JSON.parse(vehicleRulesStr)
      : {};
    const deviceRules = vehicleRulesAll[String(event.deviceId)];
    const hasDeviceRuleForType =
      !!deviceRules && deviceRules.length > 0 && deviceRules.some((r) => r.eventType === internalType);

    if (!hasDeviceRuleForType) {
      // 2) Sem regras por veículo — usar configuração global
      const isEnabled = eventsConfig[internalType] ?? false;
      if (!isEnabled) {
        console.debug(`[Notificações] Tipo "${internalType}" desabilitado — ignorado`);
        return;
      }

      // 3) Verificar filtro por veículo da central (eventDevices)
      const eventDevices: Record<string, number[]> = saved.eventDevices || {};
      const allowedDevices = eventDevices[internalType];
      if (allowedDevices && allowedDevices.length > 0 && !allowedDevices.includes(event.deviceId)) {
        console.debug(
          `[Notificações] Veículo #${event.deviceId} não está na lista de "${internalType}" — ignorado`,
        );
        return;
      }
    } else {
      console.debug(
        `[Notificações] Veículo #${event.deviceId}: tipo "${internalType}" permitido pelas regras específicas do veículo`,
      );
    }
    }
  } catch {
    /* se não conseguir ler, bloqueia por segurança */ return;
  }

  const notificationData = getNotificationDataForEvent(
    event,
    displayName,
    matchedDevice?.speedLimit,
    normalizedEventType,
  );
  if (!notificationData) return;

  if (normalizedEventType === "geofenceEnter" || normalizedEventType === "geofenceExit") {
    await registerGeofenceEventAlert(event, devices, displayName, normalizedEventType);
  }

  notificationManager.addNotification({
    type: notificationData.type,
    title: notificationData.title,
    message: notificationData.message,
    deviceId: event.deviceId,
    deviceName,
    vehicleName,
    eventType: internalType,
    latitude,
    longitude,
    speedAlertId,
  });
}

async function registerGeofenceEventAlert(
  event: Event,
  devices: Device[],
  displayName: string,
  normalizedEventType: "geofenceEnter" | "geofenceExit",
) {
  try {
    const matchedDevice = devices.find((d) => d.id === event.deviceId);
    const position = event.positionId
      ? await getPositionById(event.positionId)
      : null;
    const fallbackPosition = position || (await getPositions({ deviceId: event.deviceId })).at(0) || null;
    if (!fallbackPosition) return;

    const eventMarker = {
      id: `event-${event.id}`,
      eventType: normalizedEventType,
      deviceId: event.deviceId,
      deviceName: matchedDevice?.plate || matchedDevice?.uniqueId || displayName,
      vehicleName: matchedDevice?.name,
      latitude: fallbackPosition.latitude,
      longitude: fallbackPosition.longitude,
      currentLatitude: fallbackPosition.latitude,
      currentLongitude: fallbackPosition.longitude,
      timestamp: event.serverTime,
      label: getEventDisplayLabel(event),
    };

    try {
      const stored = localStorage.getItem("eventAlerts");
      const alerts = stored ? JSON.parse(stored) : [];
      const filtered = pruneRecentEventAlerts(alerts).filter((a: { id: string }) => a.id !== eventMarker.id);
      filtered.unshift(eventMarker);
      const recentAlerts = pruneRecentEventAlerts(filtered).slice(0, 50);
      localStorage.setItem("eventAlerts", JSON.stringify(recentAlerts));
      window.dispatchEvent(new CustomEvent("eventAlertAdded", { detail: eventMarker }));
    } catch (storageErr) {
      console.error("[GeofenceAlert] Erro ao salvar no localStorage:", storageErr);
    }

    void fetch("/api/geofence-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...event,
        type: normalizedEventType,
        sourceKey: `ui:${event.id}`,
      }),
    }).catch(() => undefined);
  } catch (error) {
    console.error("[GeofenceAlert] Erro ao registrar alerta de cerca:", error);
  }
}

function getLinkedDeviceIdsForGeofence(geofence: Geofence, knownDeviceIds: Set<number>): number[] {
  if (geofence.assignToAll) {
    return Array.from(knownDeviceIds);
  }

  const explicitIds = Array.isArray(geofence.linkedDeviceIds) ? geofence.linkedDeviceIds : [];
  if (explicitIds.length > 0) {
    return explicitIds.filter((deviceId) => knownDeviceIds.has(deviceId));
  }

  const attrIds = geofence.attributes?.linkedDeviceIds;
  if (Array.isArray(attrIds) && attrIds.length > 0) {
    return (attrIds as number[]).filter((deviceId) => knownDeviceIds.has(deviceId));
  }

  return [];
}

function isPositionInsideGeofence(position: Position, geofence: Geofence): boolean {
  const parsed = parseWKT(geofence.area);
  if (!parsed) return false;

  if (parsed.type === "circle" && parsed.center && parsed.radius) {
    const earthRadius = 6_371_000;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const lat1 = toRad(position.latitude);
    const lat2 = toRad(parsed.center[0]);
    const deltaLat = toRad(parsed.center[0] - position.latitude);
    const deltaLng = toRad(parsed.center[1] - position.longitude);
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    const distance = 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return distance <= parsed.radius;
  }

  if (parsed.type === "polygon" && parsed.coordinates && parsed.coordinates.length >= 3) {
    const x = position.longitude;
    const y = position.latitude;
    let inside = false;

    for (let i = 0, j = parsed.coordinates.length - 1; i < parsed.coordinates.length; j = i++) {
      const xi = parsed.coordinates[i][1];
      const yi = parsed.coordinates[i][0];
      const xj = parsed.coordinates[j][1];
      const yj = parsed.coordinates[j][0];
      const intersects =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
      if (intersects) inside = !inside;
    }

    return inside;
  }

  return false;
}

function pruneRecentEventAlerts(alerts: Array<{ id: string; timestamp?: string }>) {
  const cutoff = Date.now() - EVENT_ALERT_TTL_MS;
  return alerts.filter((alert) => {
    const timestamp = alert.timestamp ? new Date(alert.timestamp).getTime() : 0;
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

/**
 * Gera dados de notificação baseado no tipo de evento
 */
function getNotificationDataForEvent(
  event: Event,
  displayName: string,
  deviceSpeedLimit?: number,
  normalizedEventType?: string,
) {
  const deviceName = displayName;
  const effectiveEventType = normalizedEventType || event.type;
  const geofenceName =
    String(
      event.attributes?.geofenceName ??
        event.attributes?.geofence ??
        event.attributes?.description ??
        event.attributes?.name ??
        "",
    ).trim();
  const geofenceLabel = geofenceName || "uma cerca monitorada";

  const eventNotifications: Record<
    string,
    {
      type: "info" | "warning" | "error" | "success";
      title: string;
      message: string;
    }
  > = {
    ignitionOn: {
      type: "info",
      title: "🔑 Ignição Ligada",
      message: `${deviceName} teve a ignição ligada`,
    },
    ignitionOff: {
      type: "info",
      title: "🔑 Ignição Desligada",
      message: `${deviceName} teve a ignição desligada`,
    },
    deviceOnline: {
      type: "success",
      title: "🟢 Dispositivo Online",
      message: `${deviceName} voltou a se comunicar`,
    },
    deviceOffline: {
      type: "error",
      title: "🔴 Dispositivo Offline",
      message: `${deviceName} parou de se comunicar`,
    },
    geofenceEnter: {
      type: "info",
      title: "📍 Entrada em Cerca",
      message: `${deviceName} entrou na cerca: ${geofenceLabel}`,
    },
    geofenceExit: {
      type: "warning",
      title: "📍 Saída de Cerca",
      message: `${deviceName} saiu da cerca: ${geofenceLabel}`,
    },
    sos: {
      type: "error",
      title: "🚨 SOS / Pânico",
      message: `${deviceName} acionou o botão de pânico / SOS`,
    },
    alarm: {
      type: "warning",
      title: (() => {
        const raw = event.attributes?.alarm || event.attributes?.alarmType || event.attributes?.subtype || "";
        const s = raw != null ? String(raw).toLowerCase() : "";
        if (s === "vibration" || s === "shock" || s === "impact") return "⚠️ Alerta de Vibração";
        return "🔔 Alarme";
      })(),
      message: (() => {
        const raw = event.attributes?.alarm || event.attributes?.alarmType || event.attributes?.subtype || "";
        const s = raw != null ? String(raw).toLowerCase() : "";
        if (s === "vibration" || s === "shock" || s === "impact") {
          return `${deviceName} detectou vibração/impacto — pode ser buraco, colisão ou batida.`;
        }
        return `${deviceName} acionou um alarme: ${event.attributes?.alarm || "alarme"}`;
      })(),
    },
    deviceOverspeed: {
      type: "warning",
      title: "⚡ Excesso de Velocidade",
      message: (() => {
        const speed = event.attributes?.speed ? Math.round(event.attributes.speed * 1.852) : 0;
        const rawEvtLimit = event.attributes?.speedLimit || event.attributes?.limit || 0;
        const limit = deviceSpeedLimit || (rawEvtLimit > 0 ? Math.round(rawEvtLimit * 1.852) : 0);
        if (speed && limit) {
          return `${deviceName} atingiu ${speed} km/h (limite: ${limit} km/h)`;
        }
        return `${deviceName} excedeu o limite de velocidade`;
      })(),
    },
    speedLimit: {
      type: "warning",
      title: "⚡ Excesso de Velocidade",
      message: (() => {
        const speed = event.attributes?.speed ? Math.round(event.attributes.speed * 1.852) : 0;
        const rawEvtLimit = event.attributes?.speedLimit || event.attributes?.limit || 0;
        const limit = deviceSpeedLimit || (rawEvtLimit > 0 ? Math.round(rawEvtLimit * 1.852) : 0);
        if (speed && limit) {
          return `${deviceName} atingiu ${speed} km/h (limite: ${limit} km/h)`;
        }
        return `${deviceName} excedeu o limite de velocidade`;
      })(),
    },
    maintenance: {
      type: "info",
      title: "🔧 Manutenção",
      message: `${deviceName} requer manutenção`,
    },
    deviceMoving: {
      type: "info",
      title: "🚗 Dispositivo em Movimento",
      message: `${deviceName} começou a se movimentar`,
    },
    deviceStopped: {
      type: "info",
      title: "🛑 Dispositivo Parado",
      message: `${deviceName} parou`,
    },
    commandResult: {
      type: "info",
      title: "📟 Resultado de Comando",
      message: event.attributes?.result
        ? `${deviceName}: ${String(event.attributes.result).slice(0, 80)}`
        : `${deviceName} respondeu ao comando`,
    },
    textMessage: {
      type: "info",
      title: "💬 Mensagem de Texto",
      message: event.attributes?.message
        ? `${deviceName}: ${String(event.attributes.message).slice(0, 80)}`
        : `${deviceName} enviou uma mensagem`,
    },
    lowBattery: {
      type: "warning",
      title: "🔋 Bateria Fraca",
      message: `${deviceName} está com bateria baixa`,
    },
    driverChanged: {
      type: "info",
      title: "👤 Motorista Alterado",
      message: `${deviceName} teve o motorista alterado`,
    },
    fuelDrop: {
      type: "warning",
      title: "⛽ Queda de Combustível",
      message: `${deviceName} registrou queda de combustível`,
    },
    fuelIncrease: {
      type: "success",
      title: "⛽ Abastecimento",
      message: `${deviceName} foi abastecido`,
    },
    deviceBlocked: {
      type: "error",
      title: "🔒 Veículo Bloqueado",
      message: `${deviceName} foi bloqueado`,
    },
    deviceUnblocked: {
      type: "success",
      title: "🔓 Veículo Desbloqueado",
      message: `${deviceName} foi desbloqueado`,
    },
    media: {
      type: "info",
      title: "📷 Mídia Recebida",
      message: `${deviceName} enviou uma mídia`,
    },
  };

  const notification = eventNotifications[effectiveEventType];

  if (!notification) {
    // Notificação genérica para tipos desconhecidos
    return {
      type: "info" as const,
      title: `📢 ${effectiveEventType}`,
      message: `${deviceName} - ${effectiveEventType}`,
    };
  }

  return notification;
}
