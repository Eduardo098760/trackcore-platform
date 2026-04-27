import {
  FileText,
  Lock,
  MapPin,
  RotateCcw,
  Unlock,
} from "lucide-react";

export const BASE_COMMAND_TYPES = [
  {
    value: "positionSingle",
    label: "Consultar posição",
    description: "Solicita a posição atual do rastreador",
    icon: MapPin,
    dangerous: false,
  },
  {
    value: "engineStop",
    label: "Bloquear veículo",
    description: "Envia o comando de bloqueio do motor",
    icon: Lock,
    dangerous: true,
  },
  {
    value: "engineResume",
    label: "Desbloquear veículo",
    description: "Envia o comando para liberar o motor",
    icon: Unlock,
    dangerous: false,
  },
  {
    value: "rebootDevice",
    label: "Reiniciar rastreador",
    description: "Reinicia o dispositivo remotamente",
    icon: RotateCcw,
    dangerous: false,
  },
  {
    value: "custom",
    label: "Comando personalizado",
    description: "Envia um texto de comando definido por você",
    icon: FileText,
    dangerous: false,
  },
] as const;

export function getBaseCommandLabel(type: string) {
  return BASE_COMMAND_TYPES.find((item) => item.value === type)?.label || type;
}