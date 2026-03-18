"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getServerSettings, updateServerSettings, TraccarServer } from "@/lib/api/server";
import { useAuthStore } from "@/lib/stores/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Server, MapPin, Shield, Mail, Globe, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function ServerConfigPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState<Partial<TraccarServer>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: server, isLoading } = useQuery({
    queryKey: ["server-settings"],
    queryFn: getServerSettings,
    enabled: user?.role === "admin",
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TraccarServer>) => {
      const merged = { ...server, ...data };
      return updateServerSettings(merged);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Configurações do servidor salvas!");
      setHasChanges(false);
    },
    onError: () => {
      toast.error("Erro ao salvar configurações");
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const updateField = (key: keyof TraccarServer, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateAttribute = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      attributes: { ...server?.attributes, ...prev.attributes, [key]: value },
    }));
    setHasChanges(true);
  };

  const getValue = <K extends keyof TraccarServer>(key: K): TraccarServer[K] | undefined => {
    return key in formData ? (formData[key] as TraccarServer[K]) : server?.[key];
  };

  const getAttr = (key: string): string => {
    const attrs = { ...server?.attributes, ...formData.attributes };
    return attrs[key] ?? "";
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Server} title="Configuração do Servidor" description="Carregando..." />
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          icon={Server}
          title="Configuração do Servidor"
          description="Configure parâmetros globais do servidor Traccar"
        />
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          className="gap-2"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Segurança & Registro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Segurança & Registro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Registro Aberto</Label>
                <p className="text-xs text-muted-foreground">Permitir criação de novas contas</p>
              </div>
              <Switch
                checked={getValue("registration") ?? false}
                onCheckedChange={(v) => updateField("registration", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Somente Leitura (Global)</Label>
                <p className="text-xs text-muted-foreground">Bloquear alterações em todo o sistema</p>
              </div>
              <Switch
                checked={getValue("readonly") ?? false}
                onCheckedChange={(v) => updateField("readonly", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Dispositivos Somente Leitura</Label>
                <p className="text-xs text-muted-foreground">Impedir alterações em dispositivos</p>
              </div>
              <Switch
                checked={getValue("deviceReadonly") ?? false}
                onCheckedChange={(v) => updateField("deviceReadonly", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Limitar Comandos</Label>
                <p className="text-xs text-muted-foreground">Restringir envio de comandos</p>
              </div>
              <Switch
                checked={getValue("limitCommands") ?? false}
                onCheckedChange={(v) => updateField("limitCommands", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Forçar Configurações</Label>
                <p className="text-xs text-muted-foreground">Impedir que usuários alterem suas configurações</p>
              </div>
              <Switch
                checked={getValue("forceSettings") ?? false}
                onCheckedChange={(v) => updateField("forceSettings", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Mapa Padrão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Mapa Padrão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Provedor do Mapa</Label>
              <Select
                value={getValue("map") ?? ""}
                onValueChange={(v) => updateField("map", v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="osm">OpenStreetMap</SelectItem>
                  <SelectItem value="carto">Carto</SelectItem>
                  <SelectItem value="google">Google Maps</SelectItem>
                  <SelectItem value="bing">Bing Maps</SelectItem>
                  <SelectItem value="custom">Customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude Padrão</Label>
                <Input
                  type="number"
                  step="any"
                  value={getValue("latitude") ?? 0}
                  onChange={(e) => updateField("latitude", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Longitude Padrão</Label>
                <Input
                  type="number"
                  step="any"
                  value={getValue("longitude") ?? 0}
                  onChange={(e) => updateField("longitude", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div>
              <Label>Zoom Padrão</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={getValue("zoom") ?? 10}
                onChange={(e) => updateField("zoom", parseInt(e.target.value) || 10)}
              />
            </div>
            <div>
              <Label>URL do Mapa Customizado</Label>
              <Input
                value={getValue("mapUrl") ?? ""}
                onChange={(e) => updateField("mapUrl", e.target.value)}
                placeholder="https://tile.example.com/{z}/{x}/{y}.png"
              />
            </div>
            <div>
              <Label>Bing Maps Key</Label>
              <Input
                value={getValue("bingKey") ?? ""}
                onChange={(e) => updateField("bingKey", e.target.value)}
                placeholder="Chave da API Bing Maps"
              />
            </div>
          </CardContent>
        </Card>

        {/* Email (SMTP) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Email (SMTP)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Servidor SMTP</Label>
              <Input
                value={getAttr("mail.smtp.host")}
                onChange={(e) => updateAttribute("mail.smtp.host", e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Porta SMTP</Label>
                <Input
                  value={getAttr("mail.smtp.port")}
                  onChange={(e) => updateAttribute("mail.smtp.port", e.target.value)}
                  placeholder="587"
                />
              </div>
              <div>
                <Label>Segurança</Label>
                <Select
                  value={getAttr("mail.smtp.starttls.enable") === "true" ? "starttls" : getAttr("mail.smtp.ssl.enable") === "true" ? "ssl" : "none"}
                  onValueChange={(v) => {
                    updateAttribute("mail.smtp.starttls.enable", v === "starttls" ? "true" : "false");
                    updateAttribute("mail.smtp.ssl.enable", v === "ssl" ? "true" : "false");
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="starttls">STARTTLS</SelectItem>
                    <SelectItem value="ssl">SSL/TLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Usuário SMTP</Label>
              <Input
                value={getAttr("mail.smtp.username")}
                onChange={(e) => updateAttribute("mail.smtp.username", e.target.value)}
                placeholder="user@gmail.com"
              />
            </div>
            <div>
              <Label>Senha SMTP</Label>
              <Input
                type="password"
                value={getAttr("mail.smtp.password")}
                onChange={(e) => updateAttribute("mail.smtp.password", e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label>Remetente (From)</Label>
              <Input
                value={getAttr("mail.smtp.from")}
                onChange={(e) => updateAttribute("mail.smtp.from", e.target.value)}
                placeholder="noreply@empresa.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Forward / Webhook */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Forward / Webhook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>URL de Forward</Label>
              <Input
                value={getAttr("forward.url")}
                onChange={(e) => updateAttribute("forward.url", e.target.value)}
                placeholder="https://webhook.site/..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Envia posições em tempo real para URL externa
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Formato JSON</Label>
                <p className="text-xs text-muted-foreground">Forward em JSON (vs OsmAnd)</p>
              </div>
              <Switch
                checked={getAttr("forward.json") === "true"}
                onCheckedChange={(v) => updateAttribute("forward.json", v ? "true" : "false")}
              />
            </div>
            <Separator />
            <div>
              <Label>SMS Gateway URL</Label>
              <Input
                value={getAttr("sms.http.url")}
                onChange={(e) => updateAttribute("sms.http.url", e.target.value)}
                placeholder="https://api.sms.com/send"
              />
            </div>
            <div>
              <Label>SMS Template</Label>
              <Input
                value={getAttr("sms.http.template")}
                onChange={(e) => updateAttribute("sms.http.template", e.target.value)}
                placeholder="{phone} {message}"
              />
            </div>
          </CardContent>
        </Card>

        {/* Formato & Exibição */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Formato & Exibição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Formato 12 Horas</Label>
                <p className="text-xs text-muted-foreground">Usar AM/PM ao invés de 24h</p>
              </div>
              <Switch
                checked={getValue("twelveHourFormat") ?? false}
                onCheckedChange={(v) => updateField("twelveHourFormat", v)}
              />
            </div>
            <Separator />
            <div>
              <Label>Formato de Coordenadas</Label>
              <Select
                value={getValue("coordinateFormat") ?? "dd"}
                onValueChange={(v) => updateField("coordinateFormat", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dd">Graus Decimais (DD)</SelectItem>
                  <SelectItem value="ddm">Graus e Minutos (DDM)</SelectItem>
                  <SelectItem value="dms">Graus, Minutos e Segundos (DMS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
