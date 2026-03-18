"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getServerSettings, updateServerSettings } from "@/lib/api/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Settings2,
  Globe,
  Shield,
  Smartphone,
  AlertTriangle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth";

// ─── Provedores SMS pré-configurados ────────────────────────────────────────
const SMS_PROVIDERS = [
  {
    id: "twilio",
    name: "Twilio",
    description: "Plataforma global de comunicação",
    urlTemplate: "https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json",
    bodyTemplate: "To={phone}&From={FROM_NUMBER}&Body={message}",
    authType: "basic" as const,
    authPlaceholder: "Basic base64(AccountSID:AuthToken)",
    docsUrl: "https://www.twilio.com/docs/sms/api/message-resource",
    instructions: "Use autenticação Basic com AccountSID:AuthToken codificado em Base64. O formato é: Basic dXNlcjpwYXNz",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  {
    id: "zenvia",
    name: "Zenvia",
    description: "Plataforma brasileira de comunicação",
    urlTemplate: "https://api.zenvia.com/v2/channels/sms/messages",
    bodyTemplate: '{"from":"{FROM_ID}","to":"{phone}","contents":[{"type":"text","text":"{message}"}]}',
    authType: "token" as const,
    authPlaceholder: "X-API-TOKEN seu-token-aqui",
    docsUrl: "https://zenvia.github.io/zenvia-openapi-spec/",
    instructions: "Use o token de API da Zenvia. O header será enviado como Authorization: X-API-TOKEN xxx",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  {
    id: "comtele",
    name: "Comtele",
    description: "Plataforma brasileira de SMS em massa",
    urlTemplate: "https://api.comtele.com.br/v2/send",
    bodyTemplate: '{"Sender":"{FROM_ID}","Receivers":"{phone}","Content":"{message}"}',
    authType: "token" as const,
    authPlaceholder: "auth-key sua-chave-api",
    docsUrl: "https://docs.comtele.com.br/",
    instructions: "Use a chave de API da Comtele no header Authorization.",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    id: "vonage",
    name: "Vonage (Nexmo)",
    description: "Plataforma global de APIs de comunicação",
    urlTemplate: "https://rest.nexmo.com/sms/json?api_key={API_KEY}&api_secret={API_SECRET}&from={FROM}&to={phone}&text={message}",
    bodyTemplate: "",
    authType: "url" as const,
    authPlaceholder: "(credenciais já na URL acima)",
    docsUrl: "https://developer.vonage.com/en/messaging/sms/overview",
    instructions: "Substitua {API_KEY} e {API_SECRET} na URL com suas credenciais reais. {FROM} é o número remetente.",
    color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  {
    id: "messagebird",
    name: "MessageBird",
    description: "CPaaS global com forte presença na Europa",
    urlTemplate: "https://rest.messagebird.com/messages?originator={FROM}&recipients={phone}&body={message}",
    bodyTemplate: "",
    authType: "token" as const,
    authPlaceholder: "AccessKey sua-access-key",
    docsUrl: "https://developers.messagebird.com/api/sms-messaging/",
    instructions: "Use o AccessKey da MessageBird no header Authorization.",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  {
    id: "custom",
    name: "HTTP Personalizado",
    description: "Configure manualmente qualquer gateway HTTP",
    urlTemplate: "",
    bodyTemplate: "",
    authType: "custom" as const,
    authPlaceholder: "Bearer/Basic/Token conforme o provedor",
    docsUrl: "",
    instructions: "Use {phone} para o número do destinatário e {message} para o conteúdo da mensagem na URL ou template.",
    color: "bg-muted text-foreground",
  },
];

export default function SmsConfigPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [smsUrl, setSmsUrl] = useState("");
  const [smsTemplate, setSmsTemplate] = useState("");
  const [smsAuth, setSmsAuth] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);

  const { data: server, isLoading } = useQuery({
    queryKey: ["server-settings"],
    queryFn: getServerSettings,
  });

  useEffect(() => {
    if (server) {
      const attrs = server.attributes || {};
      const url = attrs["sms.http.url"] || "";
      const tpl = attrs["sms.http.template"] || "";
      const auth = attrs["sms.http.authorization"] || "";
      setSmsUrl(url);
      setSmsTemplate(tpl);
      setSmsAuth(auth);

      // Detectar provedor atual baseado na URL
      if (url) {
        const detected = SMS_PROVIDERS.find(
          (p) => p.id !== "custom" && url.includes(new URL(p.urlTemplate || "https://x.com").hostname),
        );
        setSelectedProvider(detected?.id || "custom");
      }
    }
  }, [server]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const attributes: Record<string, any> = { ...(server?.attributes || {}) };
      attributes["sms.http.url"] = smsUrl;
      attributes["sms.http.template"] = smsTemplate;
      attributes["sms.http.authorization"] = smsAuth;
      return updateServerSettings({ ...server, attributes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Configuração SMS salva com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar configuração SMS"),
  });

  const handleSelectProvider = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = SMS_PROVIDERS.find((p) => p.id === providerId);
    if (provider && providerId !== "custom") {
      setSmsUrl(provider.urlTemplate);
      setSmsTemplate(provider.bodyTemplate);
      // Não limpar auth pois o usuário pode já ter preenchido
    }
  };

  const handleTestSms = async () => {
    if (!testPhone.trim()) {
      toast.error("Informe o número de telefone para o teste");
      return;
    }
    setTestSending(true);
    try {
      // Monta a URL de teste substituindo placeholders
      const testUrl = smsUrl
        .replace("{phone}", encodeURIComponent(testPhone.trim()))
        .replace("{message}", encodeURIComponent("Teste de SMS - TrackCore Platform"));

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (smsAuth) {
        headers["Authorization"] = smsAuth;
      }

      const body = smsTemplate
        ? smsTemplate
            .replace("{phone}", testPhone.trim())
            .replace("{message}", "Teste de SMS - TrackCore Platform")
        : undefined;

      const res = await fetch(testUrl, {
        method: body ? "POST" : "GET",
        headers,
        body: body || undefined,
      });

      if (res.ok) {
        toast.success("SMS de teste enviado! Verifique o telefone informado.");
      } else {
        const text = await res.text();
        toast.error(`Erro HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
    } catch (err: any) {
      toast.error(`Falha na requisição: ${err.message}`);
    } finally {
      setTestSending(false);
    }
  };

  const isConfigured = !!(smsUrl);
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Apenas administradores podem configurar o gateway SMS.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MessageSquare}
        title="Configuração SMS"
        description="Configure a integração com provedores de SMS para envio de comandos e notificações via mensagem de texto."
        stats={[
          {
            label: "Status",
            value: isConfigured ? "Configurado" : "Não configurado",
            variant: isConfigured ? "success" : "warning",
          },
          {
            label: "Provedor",
            value: selectedProvider
              ? SMS_PROVIDERS.find((p) => p.id === selectedProvider)?.name || "—"
              : "—",
          },
        ]}
      />

      {/* Seleção de provedor */}
      <Card className="backdrop-blur-xl bg-card/90 border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Selecione o Provedor SMS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SMS_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleSelectProvider(provider.id)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedProvider === provider.id
                    ? "border-primary bg-primary/10 shadow-lg scale-[1.02]"
                    : "border-border hover:border-ring"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${provider.color}`}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">{provider.name}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-tight">
                  {provider.description}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuração detalhada */}
      {selectedProvider && (
        <>
          {/* Instruções do provedor */}
          {(() => {
            const provider = SMS_PROVIDERS.find((p) => p.id === selectedProvider);
            if (!provider) return null;
            return (
              <Card className="backdrop-blur-xl bg-gradient-to-r from-blue-50/80 to-cyan-50/80 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${provider.color} shrink-0`}>
                      <Settings2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">
                        Instruções — {provider.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {provider.instructions}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Placeholders disponíveis: <code className="bg-muted/50 px-1 rounded">&#123;phone&#125;</code> = número do destinatário,{" "}
                        <code className="bg-muted/50 px-1 rounded">&#123;message&#125;</code> = conteúdo da mensagem
                      </p>
                      {provider.docsUrl && (
                        <a
                          href={provider.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Documentação oficial
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Campos de configuração */}
          <Card className="backdrop-blur-xl bg-card/90 border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Credenciais e Endpoint
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>URL do Gateway SMS</Label>
                <Textarea
                  value={smsUrl}
                  onChange={(e) => setSmsUrl(e.target.value)}
                  placeholder="https://api.provider.com/sms?phone={phone}&message={message}"
                  className="mt-1 font-mono text-sm min-h-[80px]"
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  URL completa com placeholders &#123;phone&#125; e &#123;message&#125;. Usada como GET se não houver template de body.
                </p>
              </div>

              <div>
                <Label>Template do Body (POST)</Label>
                <Textarea
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  placeholder='{"to":"{phone}","text":"{message}"}'
                  className="mt-1 font-mono text-sm min-h-[80px]"
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Se preenchido, a requisição será POST com este conteúdo como body. Deixe vazio para GET.
                </p>
              </div>

              <div>
                <Label>Authorization Header</Label>
                <div className="relative">
                  <Input
                    type="password"
                    value={smsAuth}
                    onChange={(e) => setSmsAuth(e.target.value)}
                    placeholder={
                      SMS_PROVIDERS.find((p) => p.id === selectedProvider)
                        ?.authPlaceholder || "Bearer/Basic token"
                    }
                    className="mt-1 font-mono text-sm pr-10"
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Valor do header Authorization enviado nas requisições. Ex: Bearer xxx, Basic xxx, Token xxx
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !smsUrl}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Salvar Configuração
                </Button>

                {saveMutation.isSuccess && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Salvo
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Teste de SMS */}
          <Card className="backdrop-blur-xl bg-card/90 border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="w-5 h-5" />
                Testar Envio de SMS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Envie uma mensagem de teste para verificar se a configuração está funcionando.
                Certifique-se de salvar as credenciais antes de testar.
              </p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Número de telefone</Label>
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+5511999999999"
                    className="mt-1"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Use formato internacional com código do país
                  </p>
                </div>
              </div>
              <Button
                onClick={handleTestSms}
                disabled={testSending || !smsUrl || !testPhone.trim()}
                variant="outline"
                className="gap-2"
              >
                {testSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar SMS de Teste
              </Button>
            </CardContent>
          </Card>

          {/* Dicas */}
          <Card className="backdrop-blur-xl bg-gradient-to-r from-yellow-50/80 to-orange-50/80 dark:from-yellow-950/20 dark:to-orange-950/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-yellow-500 rounded-lg shrink-0">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-yellow-900 dark:text-yellow-200 mb-1">
                    Dicas importantes
                  </h4>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1.5 list-disc list-inside">
                    <li>
                      O Traccar substitui <code className="bg-muted/50 px-1 rounded text-xs">&#123;phone&#125;</code> pelo número do dispositivo e{" "}
                      <code className="bg-muted/50 px-1 rounded text-xs">&#123;message&#125;</code> pelo conteúdo do comando.
                    </li>
                    <li>
                      O número do telefone vem do campo &quot;Telefone&quot; cadastrado no dispositivo no Traccar.
                    </li>
                    <li>
                      Para comandos SMS, o dispositivo precisa ter um número de telefone/SIM configurado.
                    </li>
                    <li>
                      Após configurar, ative &quot;Enviar via SMS&quot; na tela de Comandos para usar este gateway.
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
