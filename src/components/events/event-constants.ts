import type { UserRole } from "@/types";

/** Categorias de eventos para agrupamento nos filtros */
export const EVENT_CATEGORIES: {
  label: string;
  types: { value: string; label: string }[];
}[] = [
  {
    label: "Velocidade",
    types: [
      { value: "speedLimit", label: "Excesso de velocidade" },
      { value: "deviceOverspeed", label: "Excesso (dispositivo)" },
    ],
  },
  {
    label: "Cercas Eletrônicas",
    types: [
      { value: "geofenceEnter", label: "Entrada em cerca" },
      { value: "geofenceExit", label: "Saída de cerca" },
    ],
  },
  {
    label: "Ignição",
    types: [
      { value: "ignitionOn", label: "Ignição ligada" },
      { value: "ignitionOff", label: "Ignição desligada" },
    ],
  },
  {
    label: "Conexão / Status",
    types: [
      { value: "deviceOnline", label: "Dispositivo online" },
      { value: "deviceOffline", label: "Dispositivo offline" },
      { value: "deviceUnknown", label: "Status desconhecido" },
      { value: "deviceInactive", label: "Dispositivo inativo" },
    ],
  },
  {
    label: "Movimento",
    types: [
      { value: "deviceMoving", label: "Em movimento" },
      { value: "deviceStopped", label: "Parado" },
    ],
  },
  {
    label: "Alarmes",
    types: [
      { value: "alarm", label: "Alarme (todos)" },
    ],
  },
  {
    label: "Combustível",
    types: [
      { value: "fuelDrop", label: "Queda de combustível" },
      { value: "fuelIncrease", label: "Abastecimento" },
    ],
  },
  {
    label: "Comandos",
    types: [
      { value: "commandResult", label: "Resultado de comando" },
      { value: "textMessage", label: "Mensagem de texto" },
    ],
  },
  {
    label: "Outros",
    types: [
      { value: "maintenance", label: "Manutenção" },
      { value: "driverChanged", label: "Motorista alterado" },
      { value: "lowBattery", label: "Bateria fraca" },
      { value: "deviceBlocked", label: "Veículo bloqueado" },
      { value: "deviceUnblocked", label: "Veículo desbloqueado" },
      { value: "media", label: "Mídia" },
    ],
  },
];

/** Lista plana para o select de filtros */
export const EVENT_TYPES: { value: string; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  ...EVENT_CATEGORIES.flatMap((c) => c.types),
];

/** Subtipos de alarme do Traccar */
export const ALARM_SUBTYPES: Record<string, string> = {
  general: "Alarme geral",
  sos: "SOS / Pânico",
  vibration: "Vibração",
  overspeed: "Excesso de velocidade (dispositivo)",
  lowPower: "Tensão baixa",
  lowBattery: "Bateria fraca",
  geofenceEnter: "Entrada em cerca (dispositivo)",
  geofenceExit: "Saída de cerca (dispositivo)",
  tampering: "Adulteração",
  removing: "Remoção do dispositivo",
  powerCut: "Corte de energia",
  powerRestored: "Energia restaurada",
  door: "Porta aberta",
  movement: "Movimento detectado",
  parking: "Estacionamento",
  shock: "Impacto / Colisão",
  bonnet: "Capô aberto",
  footBrake: "Freio de pé",
  hardAcceleration: "Aceleração brusca",
  hardBraking: "Frenagem brusca",
  hardCornering: "Curva brusca",
  fatigueDriving: "Direção por fadiga",
  powerOn: "Dispositivo ligado",
  powerOff: "Dispositivo desligado",
  accident: "Acidente",
  tow: "Reboque detectado",
  idle: "Ocioso",
  temperature: "Temperatura",
  jamming: "Bloqueio de sinal",
  fall: "Queda detectada",
};

export const PERIOD_OPTIONS: { value: string; label: string; days: number }[] =
  [
    { value: "1", label: "Últimas 24 horas", days: 1 },
    { value: "3", label: "Últimos 3 dias", days: 3 },
    { value: "7", label: "Últimos 7 dias", days: 7 },
    { value: "30", label: "Últimos 30 dias", days: 30 },
    { value: "90", label: "Últimos 90 dias", days: 90 },
  ];

export const EVENTS_PER_PAGE = 50;

export function getDeviceIdsForUser(
  deviceList: { id: number; clientId?: number }[],
  user: { role?: UserRole; clientId?: number } | null,
): number[] {
  if (!deviceList.length) return [];
  const fullAccessRoles: UserRole[] = [
    "admin",
    "manager",
    "user",
    "deviceReadonly",
  ];
  if (!user?.role || fullAccessRoles.includes(user.role))
    return deviceList.map((d) => d.id);
  if (user.role === "readonly") {
    if (user.clientId == null) return deviceList.map((d) => d.id);
    return deviceList
      .filter((d) => d.clientId === user.clientId)
      .map((d) => d.id);
  }
  return [];
}
