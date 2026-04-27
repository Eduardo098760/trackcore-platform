"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getSupportedCommandTypes, sendCommand } from "@/lib/api";
import { Device, Command, SmsProviderResponse } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  WifiOff,
  MessageSquare,
} from "lucide-react";
import { deriveDeviceStatus } from "@/lib/utils";
import { BASE_COMMAND_TYPES } from "@/lib/commands/catalog";
import { usePermissions } from "@/lib/hooks/usePermissions";

const COMMAND_TYPES = BASE_COMMAND_TYPES;

// ─── Histórico local (localStorage) ─────────────────────────────────────────
const STORAGE_KEY = "commandHistory";
const MAX_HISTORY = 50;

function addToLocalHistory(
  deviceId: number,
  type: string,
  status: Command["status"],
  textChannel?: boolean,
  providerResponse?: SmsProviderResponse | null,
) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items: Command[] = raw ? JSON.parse(raw) : [];
    const entry: Command = {
      id: Date.now(),
      deviceId,
      type,
      sentTime: new Date().toISOString(),
      status,
      textChannel,
      providerResponse: providerResponse || null,
    };
    const updated = [entry, ...items].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

interface SendCommandDialogProps {
  device: Device | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendCommandDialog({ device, open, onOpenChange }: SendCommandDialogProps) {
  const { can } = usePermissions();
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [useSms, setUseSms] = useState(false);
  const [confirmDangerous, setConfirmDangerous] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const isOffline = useMemo(() => {
    if (!device) return false;
    const status = deriveDeviceStatus(device.status);
    return status === "offline" || status === "unknown";
  }, [device]);

  const { data: supportedCommandTypes = [] } = useQuery({
    queryKey: ["device-command-types", device?.id, useSms],
    queryFn: () => getSupportedCommandTypes(device!.id, useSms),
    enabled: !!device?.id,
  });

  const supportedCommands = useMemo(() => new Set(supportedCommandTypes), [supportedCommandTypes]);

  useEffect(() => {
    if (selected && supportedCommandTypes.length > 0 && !supportedCommands.has(selected)) {
      setSelected(null);
      setConfirmDangerous(false);
      setResult({
        success: false,
        message: `O canal atual não suporta esse comando para este veículo. Suportados: ${supportedCommandTypes.join(", ")}.`,
      });
    }
  }, [selected, supportedCommandTypes, supportedCommands]);

  const mutation = useMutation({
    mutationFn: ({ deviceId, type, attributes, textChannel }: { deviceId: number; type: string; attributes?: Record<string, any>; textChannel?: boolean }) =>
      sendCommand(deviceId, type, attributes, textChannel),
    onSuccess: (data, variables) => {
      addToLocalHistory(
        variables.deviceId,
        variables.type,
        "sent",
        variables.textChannel,
        data?.providerResponse || null,
      );
      const provider = data?.providerResponse;
      setResult({
        success: true,
        message: provider
          ? `Situação: ${provider.situacao} | Código: ${provider.codigo || "-"} | ID: ${provider.id || "-"} | ${provider.descricao || "-"}`
          : "Comando enviado com sucesso!",
      });
      setTimeout(() => {
        setSelected(null);
        setCustomText("");
        setUseSms(false);
        setResult(null);
        setConfirmDangerous(false);
        onOpenChange(false);
      }, 1500);
    },
    onError: (err: any, variables) => {
      addToLocalHistory(variables.deviceId, variables.type, "failed", variables.textChannel, null);
      const details = err?.details;
      const detailText = typeof details === "string"
        ? details
        : details
          ? JSON.stringify(details)
          : "";
      const msg = err?.details?.message || err?.message || detailText || "Falha ao enviar comando";
      setResult({ success: false, message: msg });
    },
  });

  const handleSend = () => {
    if (!device || !selected) return;
    if (supportedCommandTypes.length > 0 && !supportedCommands.has(selected)) {
      setResult({
        success: false,
        message: `O comando ${selected} não é suportado para este veículo nesse canal.`,
      });
      return;
    }
    const cmd = COMMAND_TYPES.find((c) => c.value === selected);
    if (cmd?.dangerous && !confirmDangerous) {
      setConfirmDangerous(true);
      return;
    }
    const attributes: Record<string, any> = {};
    if (selected === "custom" && customText.trim()) {
      attributes.data = customText.trim();
    }
    mutation.mutate({ deviceId: device.id, type: selected, attributes, textChannel: useSms || undefined });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelected(null);
      setCustomText("");
      setUseSms(false);
      setResult(null);
      setConfirmDangerous(false);
      mutation.reset();
    }
    onOpenChange(open);
  };

  if (!device || !can("commands")) return null;

  const selectedCmd = COMMAND_TYPES.find((c) => c.value === selected);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Enviar Comando
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {device.name}{device.plate ? ` · ${device.plate}` : ""}
          </p>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold">Hierarquia do fluxo</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              1. A empresa de envio SMS é definida na tela Configuração SMS.
            </p>
            <p className="text-[11px] text-muted-foreground">
              2. Este modal apenas usa essa configuração para enviar o comando ao veículo selecionado.
            </p>
            <p className="text-[11px] text-muted-foreground">
              3. Se existir um comando salvo, mantenha o mesmo padrão usado na tela Comandos Salvos.
            </p>
          </div>

          {/* Offline warning */}
          {isOffline && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Veículo offline — o envio imediato pode falhar e depende do tipo de comando, do canal configurado e do suporte do rastreador.
                </p>
              </div>
            </div>
          )}

          {/* Command options */}
          <div className="grid grid-cols-2 gap-2">
            {COMMAND_TYPES.map((cmd) => {
              const Icon = cmd.icon;
              const isSelected = selected === cmd.value;
              const isSupported = supportedCommandTypes.length === 0 || supportedCommands.has(cmd.value);
              return (
                <button
                  key={cmd.value}
                  onClick={() => {
                    if (!isSupported) return;
                    setSelected(cmd.value);
                    setConfirmDangerous(false);
                    setResult(null);
                    mutation.reset();
                  }}
                  disabled={mutation.isPending || !isSupported}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? `bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-transparent shadow-lg`
                      : isSupported
                        ? "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        : "border-gray-200 dark:border-gray-800 opacity-45 cursor-not-allowed"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? "text-white" : ""}`} />
                  <p className={`text-xs font-semibold ${isSelected ? "text-white" : ""}`}>
                    {cmd.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                    {isSupported ? cmd.description : "Não suportado para este veículo nesse canal"}
                  </p>
                </button>
              );
            })}
          </div>

          {device && supportedCommandTypes.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Tipos suportados neste canal: {supportedCommandTypes.join(", ")}
            </p>
          )}

          {/* Custom command text field */}
          {selected === "custom" && (
            <div>
              <Input
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Ex: relay,1#"
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use o mesmo padrão adotado na tela de Comandos Salvos para manter consistência.
              </p>
            </div>
          )}

          {/* Canal de envio: GPRS ou SMS */}
          {selected && (
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/40">
              <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Enviar via SMS</p>
                <p className="text-[10px] text-muted-foreground">
                  Usa a empresa definida em Configuração SMS quando o envio por dados não funcionar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUseSms(!useSms)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${useSms ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${useSms ? "translate-x-5" : ""}`} />
              </button>
            </div>
          )}

          {/* Confirm dangerous warning */}
          {confirmDangerous && selectedCmd?.dangerous && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                    Tem certeza?
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                    O comando de bloqueio cortará a alimentação do motor. Certifique-se de que o veículo está em local seguro.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Result feedback */}
          {result && (
            <div className={`p-3 rounded-lg border ${
              result.success
                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
            }`}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                )}
                <p className={`text-sm font-medium ${
                  result.success
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
                }`}>
                  {result.message}
                </p>
              </div>
            </div>
          )}

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={
              !selected ||
              mutation.isPending ||
              (selected === "custom" && !customText.trim()) ||
              (supportedCommandTypes.length > 0 && selected != null && !supportedCommands.has(selected))
            }
            className={`w-full ${
              confirmDangerous && selectedCmd?.dangerous
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            }`}
            size="lg"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : confirmDangerous && selectedCmd?.dangerous ? (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Confirmar Bloqueio
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Comando
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { COMMAND_TYPES };
