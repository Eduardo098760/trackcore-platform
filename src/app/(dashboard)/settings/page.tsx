"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/lib/stores/auth";
import { useSettingsStore } from "@/lib/stores/settings";
import { useTenantColors } from "@/lib/hooks/useTenantColors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getServerSettings, updateServerSettings, type TraccarServer } from "@/lib/api/server";
import {
  Settings,
  User,
  Bell,
  Map,
  Globe,
  Palette,
  Save,
  Server,
  Shield,
  Mail,
  Loader2,
  Smartphone,
  Webhook,
  MessageSquare,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// ─── Server Settings Tab (admin only) ─────────────────────────────────
function ServerSettingsTab() {
  const [form, setForm] = useState<Partial<TraccarServer>>({});
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpSsl, setSmtpSsl] = useState(false);

  // SMS Gateway
  const [smsHttpUrl, setSmsHttpUrl] = useState("");
  const [smsHttpTemplate, setSmsHttpTemplate] = useState("");
  const [smsHttpAuth, setSmsHttpAuth] = useState("");

  // Firebase Push
  const [firebaseKey, setFirebaseKey] = useState("");

  // Webhook / Forwarding
  const [forwardUrl, setForwardUrl] = useState("");
  const [forwardJson, setForwardJson] = useState(true);

  const queryClient = useQueryClient();

  const { data: server, isLoading } = useQuery({
    queryKey: ["server-settings"],
    queryFn: getServerSettings,
  });

  useEffect(() => {
    if (server) {
      setForm({
        registration: server.registration,
        readonly: server.readonly,
        deviceReadonly: server.deviceReadonly,
        limitCommands: server.limitCommands,
        map: server.map,
        bingKey: server.bingKey,
        mapUrl: server.mapUrl,
        latitude: server.latitude,
        longitude: server.longitude,
        zoom: server.zoom,
        twelveHourFormat: server.twelveHourFormat,
        forceSettings: server.forceSettings,
        coordinateFormat: server.coordinateFormat,
      });
      const attrs = server.attributes || {};
      setSmtpHost(attrs["mail.smtp.host"] || "");
      setSmtpPort(attrs["mail.smtp.port"] || "");
      setSmtpUser(attrs["mail.smtp.username"] || "");
      setSmtpPassword(attrs["mail.smtp.password"] || "");
      setSmtpFrom(attrs["mail.smtp.from"] || "");
      setSmtpSsl(attrs["mail.smtp.ssl.enable"] === "true" || attrs["mail.smtp.ssl.enable"] === true);
      // SMS
      setSmsHttpUrl(attrs["sms.http.url"] || "");
      setSmsHttpTemplate(attrs["sms.http.template"] || "");
      setSmsHttpAuth(attrs["sms.http.authorization"] || "");
      // Firebase
      setFirebaseKey(attrs["notificator.firebase.key"] || "");
      // Webhook / Forwarding
      setForwardUrl(attrs["forward.url"] || "");
      setForwardJson(attrs["forward.json"] !== false && attrs["forward.json"] !== "false");
    }
  }, [server]);

  const mutation = useMutation({
    mutationFn: (data: Partial<TraccarServer>) => updateServerSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Configurações do servidor salvas!");
    },
    onError: () => toast.error("Erro ao salvar configurações do servidor"),
  });

  const handleSave = () => {
    const attributes: Record<string, any> = { ...(server?.attributes || {}) };
    if (smtpHost) attributes["mail.smtp.host"] = smtpHost;
    if (smtpPort) attributes["mail.smtp.port"] = smtpPort;
    if (smtpUser) attributes["mail.smtp.username"] = smtpUser;
    if (smtpPassword) attributes["mail.smtp.password"] = smtpPassword;
    if (smtpFrom) attributes["mail.smtp.from"] = smtpFrom;
    attributes["mail.smtp.ssl.enable"] = String(smtpSsl);

    // SMS Gateway
    if (smsHttpUrl) attributes["sms.http.url"] = smsHttpUrl;
    if (smsHttpTemplate) attributes["sms.http.template"] = smsHttpTemplate;
    if (smsHttpAuth) attributes["sms.http.authorization"] = smsHttpAuth;

    // Firebase
    if (firebaseKey) attributes["notificator.firebase.key"] = firebaseKey;

    // Webhook / Forwarding
    if (forwardUrl) attributes["forward.url"] = forwardUrl;
    attributes["forward.json"] = forwardJson;

    mutation.mutate({ ...form, attributes });
  };

  const setField = <K extends keyof TraccarServer>(key: K, value: TraccarServer[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Permissões e Registro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" /> Permissões e Registro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { key: "registration" as const, label: "Registro aberto", desc: "Permite que novos usuários se registrem" },
              { key: "readonly" as const, label: "Somente leitura", desc: "Todos os usuários ficam somente leitura" },
              { key: "deviceReadonly" as const, label: "Dispositivos somente leitura", desc: "Bloqueia edição de dispositivos" },
              { key: "limitCommands" as const, label: "Limitar comandos", desc: "Restringe comandos aos tipos salvos" },
              { key: "forceSettings" as const, label: "Forçar configurações", desc: "Impede que usuários alterem preferências" },
              { key: "twelveHourFormat" as const, label: "Formato 12 horas", desc: "Usa AM/PM ao invés de 24h" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm">{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={!!form[key]}
                  onCheckedChange={(v) => setField(key, v)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mapa padrão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Map className="w-5 h-5" /> Mapa Padrão do Servidor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Provedor de mapa</Label>
              <Select value={form.map || ""} onValueChange={(v) => setField("map", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="osm">OpenStreetMap</SelectItem>
                  <SelectItem value="carto">Carto</SelectItem>
                  <SelectItem value="bingRoad">Bing Roads</SelectItem>
                  <SelectItem value="bingAerial">Bing Aerial</SelectItem>
                  <SelectItem value="bingHybrid">Bing Hybrid</SelectItem>
                  <SelectItem value="custom">Custom (URL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato de coordenadas</Label>
              <Select
                value={form.coordinateFormat || "dd"}
                onValueChange={(v) => setField("coordinateFormat", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dd">Graus decimais (DD)</SelectItem>
                  <SelectItem value="ddm">Graus e minutos (DDM)</SelectItem>
                  <SelectItem value="dms">Graus, min e seg (DMS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.map === "custom" && (
            <div>
              <Label>URL do tile server</Label>
              <Input
                value={form.mapUrl || ""}
                onChange={(e) => setField("mapUrl", e.target.value)}
                placeholder="https://tile.example.com/{z}/{x}/{y}.png"
                className="mt-1"
              />
            </div>
          )}
          {(form.map === "bingRoad" || form.map === "bingAerial" || form.map === "bingHybrid") && (
            <div>
              <Label>Bing Maps Key</Label>
              <Input
                value={form.bingKey || ""}
                onChange={(e) => setField("bingKey", e.target.value)}
                placeholder="Sua chave de API do Bing Maps"
                className="mt-1"
              />
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Latitude padrão</Label>
              <Input
                type="number"
                step="any"
                value={form.latitude ?? 0}
                onChange={(e) => setField("latitude", parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Longitude padrão</Label>
              <Input
                type="number"
                step="any"
                value={form.longitude ?? 0}
                onChange={(e) => setField("longitude", parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Zoom padrão</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.zoom ?? 10}
                onChange={(e) => setField("zoom", parseInt(e.target.value) || 10)}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMTP / Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5" /> Configuração de E-mail (SMTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Servidor SMTP</Label>
              <Input
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Porta</Label>
              <Input
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Usuário</Label>
              <Input
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="seu@email.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label>E-mail remetente (From)</Label>
              <Input
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                placeholder="noreply@empresa.com"
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label className="text-sm">SSL/TLS</Label>
                <p className="text-xs text-muted-foreground">Conexão criptografada</p>
              </div>
              <Switch checked={smtpSsl} onCheckedChange={setSmtpSsl} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMS Gateway */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="w-5 h-5" /> Gateway SMS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configure um gateway HTTP para envio de SMS. O Traccar enviará requisições HTTP para a URL configurada.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>URL do Gateway SMS</Label>
              <Input
                value={smsHttpUrl}
                onChange={(e) => setSmsHttpUrl(e.target.value)}
                placeholder="https://api.sms-provider.com/send?phone={phone}&message={message}"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use &#123;phone&#125; e &#123;message&#125; como placeholders na URL
              </p>
            </div>
            <div>
              <Label>Template da Mensagem</Label>
              <Input
                value={smsHttpTemplate}
                onChange={(e) => setSmsHttpTemplate(e.target.value)}
                placeholder="{message}"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Authorization Header</Label>
              <Input
                type="password"
                value={smsHttpAuth}
                onChange={(e) => setSmsHttpAuth(e.target.value)}
                placeholder="Bearer token / Basic auth"
                className="mt-1"
                autoComplete="new-password"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Firebase Push */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Firebase Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configure a chave do servidor Firebase (FCM) para envio de notificações push para dispositivos móveis.
          </p>
          <div>
            <Label>Server Key do Firebase (FCM)</Label>
            <Input
              type="password"
              value={firebaseKey}
              onChange={(e) => setFirebaseKey(e.target.value)}
              placeholder="AIzaSy... (Server Key do console Firebase)"
              className="mt-1"
              autoComplete="new-password"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Obtida em Firebase Console → Project Settings → Cloud Messaging → Server key
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Webhook / Event Forwarding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Webhook className="w-5 h-5" /> Webhook / Encaminhamento de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Encaminhe posições e eventos para uma URL externa via HTTP POST.
          </p>
          <div>
            <Label>URL de Forwarding</Label>
            <Input
              value={forwardUrl}
              onChange={(e) => setForwardUrl(e.target.value)}
              placeholder="https://seu-servidor.com/api/traccar-webhook"
              className="mt-1"
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="text-sm">Formato JSON</Label>
              <p className="text-xs text-muted-foreground">Enviar dados em formato JSON (recomendado)</p>
            </div>
            <Switch checked={forwardJson} onCheckedChange={setForwardJson} />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={mutation.isPending}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
        size="lg"
      >
        {mutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Salvar Configurações do Servidor
      </Button>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuthStore();
  const colors = useTenantColors();
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    mapProvider,
    setMapProvider,
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval,
  } = useSettingsStore();

  const [saved, setSaved] = useState(false);
  const isAdmin = user?.role === "admin";

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const getUserInitials = () => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-3xl blur-3xl opacity-10"
          style={{ background: colors.inline.primaryLight }}
        ></div>
        <Card className="relative backdrop-blur-xl bg-card/80 border-border shadow-2xl">
          <CardHeader>
            <CardTitle
              className="text-3xl font-bold flex items-center gap-3"
              style={{ color: `hsl(${colors.primary.light})` }}
            >
              <Settings className="w-8 h-8" style={{ color: `hsl(${colors.primary.light})` }} />
              Configurações
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Personalize sua experiência na plataforma
            </p>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="preferences">
        <TabsList className="mb-4">
          <TabsTrigger value="preferences" className="gap-2">
            <Palette className="w-4 h-4" /> Preferências
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="server" className="gap-2">
              <Server className="w-4 h-4" /> Servidor
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Preferences Tab ── */}
        <TabsContent value="preferences">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Profile Section */}
            <Card className="lg:col-span-1 backdrop-blur-xl bg-card/90 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Perfil do Usuário
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center">
                  <Avatar className="w-24 h-24 mb-4">
                    <AvatarFallback
                      className="text-white text-2xl"
                      style={{
                        background: `linear-gradient(135deg, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
                      }}
                    >
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-xl font-bold text-foreground">{user?.name}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <div
                    className="mt-2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{
                      background:
                        user?.role === "admin" || user?.role === "manager" || user?.role === "user"
                          ? `linear-gradient(135deg, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`
                          : user?.role === "readonly" || user?.role === "deviceReadonly"
                            ? "rgba(107, 114, 128, 0.1)"
                            : "rgba(251, 191, 36, 0.15)",
                      color:
                        user?.role === "admin" || user?.role === "manager" || user?.role === "user"
                          ? "white"
                          : user?.role === "readonly" || user?.role === "deviceReadonly"
                            ? "rgb(107, 114, 128)"
                            : "rgb(217, 119, 6)",
                    }}
                  >
                    {user?.role === "admin"
                      ? "Administrador"
                      : user?.role === "manager"
                        ? "Gerente"
                        : user?.role === "user"
                          ? "Usuário"
                          : user?.role === "readonly" || user?.role === "deviceReadonly"
                            ? "Somente Leitura"
                            : "Leit. Dispositivos"}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label>Nome</Label>
                    <Input defaultValue={user?.name} className="mt-2 bg-card" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      defaultValue={user?.email}
                      className="mt-2 bg-card"
                      disabled
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input defaultValue={user?.phone} className="mt-2 bg-card" />
                  </div>
                </div>

                <Button
                  className="w-full text-white"
                  style={{
                    background: `linear-gradient(135deg, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
                  }}
                >
                  Atualizar Perfil
                </Button>
              </CardContent>
            </Card>

            {/* Settings Section */}
            <Card className="lg:col-span-2 backdrop-blur-xl bg-card/90 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Preferências
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Appearance */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Palette className="w-5 h-5" style={{ color: `hsl(${colors.primary.light})` }} />
                    Aparência
                  </h3>

                  <div className="grid gap-4">
                    <div>
                      <Label>Tema</Label>
                      <Select value={theme} onValueChange={(value: any) => setTheme(value)}>
                        <SelectTrigger className="mt-2 bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Claro</SelectItem>
                          <SelectItem value="dark">Escuro</SelectItem>
                          <SelectItem value="system">Sistema</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Idioma</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="mt-2 bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="es-ES">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Map Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Map className="w-5 h-5" style={{ color: `hsl(${colors.primary.light})` }} />
                    Configurações de Mapa
                  </h3>

                  <div>
                    <Label>Provedor de Mapas</Label>
                    <Select value={mapProvider} onValueChange={(value: any) => setMapProvider(value)}>
                      <SelectTrigger className="mt-2 bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mapbox">Mapbox</SelectItem>
                        <SelectItem value="google">Google Maps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Notifications */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Bell className="w-5 h-5" style={{ color: `hsl(${colors.primary.light})` }} />
                    Notificações e Atualização
                  </h3>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                    <div>
                      <Label className="text-base">Atualização Automática</Label>
                      <p className="text-sm text-muted-foreground">
                        Atualizar dados automaticamente
                      </p>
                    </div>
                    <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                  </div>

                  {autoRefresh && (
                    <div>
                      <Label>Intervalo de Atualização (segundos)</Label>
                      <Select
                        value={refreshInterval.toString()}
                        onValueChange={(value) => setRefreshInterval(parseInt(value))}
                      >
                        <SelectTrigger className="mt-2 bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 segundos</SelectItem>
                          <SelectItem value="30">30 segundos</SelectItem>
                          <SelectItem value="60">1 minuto</SelectItem>
                          <SelectItem value="120">2 minutos</SelectItem>
                          <SelectItem value="300">5 minutos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <Separator />

                <Button
                  onClick={handleSave}
                  className="w-full text-white"
                  size="lg"
                  style={{
                    background: `linear-gradient(135deg, hsl(${colors.primary.light}), hsl(${colors.primary.dark}))`,
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Configurações
                </Button>

                {saved && (
                  <div
                    className="p-4 border rounded-lg text-center"
                    style={{
                      backgroundColor: `hsl(${colors.primary.light.split(" ")[0]} 100% 95%)`,
                      borderColor: `hsl(${colors.primary.light})`,
                    }}
                  >
                    <p
                      className="text-sm font-medium"
                      style={{ color: `hsl(${colors.primary.light})` }}
                    >
                      ✓ Configurações salvas com sucesso!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Server Tab (admin only) ── */}
        {isAdmin && (
          <TabsContent value="server">
            <ServerSettingsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
