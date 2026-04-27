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
  Loader2,
  Send,
  Settings2,
  Globe,
  Shield,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth";

// ─── Provedores SMS pré-configurados ────────────────────────────────────────
const SMS_PROVIDERS = [
  {
    id: "smsdev",
    name: "SMS Dev",
    description: "Gateway brasileiro de envio de SMS transacional e em massa",
    urlTemplate: "https://api.smsdev.com.br/v1/send",
    bodyTemplate: '{"key":"{SMSDEV_KEY}","type":"9","number":"{phone}","msg":"{message}"}',
    authType: "url" as const,
    authPlaceholder: "A chave vai na URL como parâmetro key",
    docsUrl: "https://api.smsdev.com.br/v1/send",
    instructions: "Informe a chave da SMS Dev no campo dedicado. A plataforma irá configurar o Traccar para enviar POST JSON direto à SMS Dev com key, type=9, number e msg.",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
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
  const [smsDevKey, setSmsDevKey] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);

  const buildSmsDevDirectUrl = () => "https://api.smsdev.com.br/v1/send";

  const buildSmsDevDirectTemplate = (apiKey: string) => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      return "";
    }

    return JSON.stringify({
      key: trimmedKey,
      type: "9",
      number: "{phone}",
      msg: "{message}",
    });
  };

  const maskSmsDevTemplate = (template: string) =>
    template.replace(/("key"\s*:\s*")([^"]+)(")/i, '$1***MASCARADO***$3');

  const displayedSmsUrl =
    selectedProvider === "smsdev"
      ? buildSmsDevDirectUrl()
      : smsUrl;

  const displayedSmsTemplate =
    selectedProvider === "smsdev"
      ? maskSmsDevTemplate(smsTemplate)
      : smsTemplate;

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
      const providerAttr = attrs["sms.provider"] || "";
      const savedSmsDevKey = attrs["smsdev.apiKey"] || "";
      setSmsUrl(url);
      setSmsTemplate(tpl);
      setSmsAuth(auth);
      setSmsDevKey(savedSmsDevKey);

      // Detectar provedor atual baseado na URL
      if (url) {
        if (providerAttr === "smsdev" || url.includes("api.smsdev.com.br/v1/send")) {
          setSelectedProvider("smsdev");
          setSmsUrl(buildSmsDevDirectUrl());
          setSmsAuth("");
          const templateKeyMatch = String(tpl || "").match(/"key"\s*:\s*"([^"]+)"/i);
          const resolvedKey = savedSmsDevKey || templateKeyMatch?.[1] || "";
          setSmsDevKey(resolvedKey);
          setSmsTemplate(buildSmsDevDirectTemplate(resolvedKey));
          return;
        }

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
      if (selectedProvider === "smsdev") {
        const trimmedKey = smsDevKey.trim();
        if (!trimmedKey) {
          throw new Error("Informe a chave da API da SMS Dev.");
        }
        attributes["sms.provider"] = "smsdev";
        attributes["smsdev.apiKey"] = trimmedKey;
        attributes["sms.http.url"] = buildSmsDevDirectUrl();
        attributes["sms.http.template"] = buildSmsDevDirectTemplate(trimmedKey);
        attributes["sms.http.authorization"] = "";
      } else {
        attributes["sms.provider"] = selectedProvider || "custom";
        delete attributes["smsdev.apiKey"];
        attributes["sms.http.url"] = smsUrl;
        attributes["sms.http.template"] = smsTemplate;
        attributes["sms.http.authorization"] = smsAuth;
      }

      return updateServerSettings({ ...server, attributes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-settings"] });
      toast.success("Configuração SMS salva com sucesso!");
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao salvar configuração SMS"),
  });

  const handleSelectProvider = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = SMS_PROVIDERS.find((p) => p.id === providerId);
    if (provider && providerId !== "custom") {
      if (providerId === "smsdev") {
        const nextKey = smsDevKey.trim();
        setSmsUrl(buildSmsDevDirectUrl());
        setSmsTemplate(
          nextKey
            ? buildSmsDevDirectTemplate(nextKey)
            : '{"key":"{SMSDEV_KEY}","type":"9","number":"{phone}","msg":"{message}"}'
        );
        setSmsAuth("");
      } else {
        setSmsUrl(provider.urlTemplate);
        setSmsTemplate(provider.bodyTemplate);
      }
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
      const effectiveUrl =
        selectedProvider === "smsdev"
          ? buildSmsDevDirectUrl()
          : smsUrl;
      const effectiveTemplate =
        selectedProvider === "smsdev"
          ? buildSmsDevDirectTemplate(smsDevKey.trim())
          : smsTemplate;

      const res = await fetch("/api/sms/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: effectiveUrl,
          template: effectiveTemplate,
          authorization: selectedProvider === "smsdev" ? "" : smsAuth,
          phone: testPhone.trim(),
          message: "Teste de SMS - Plataforma Rastrear",
        }),
      });

      const payload = await res.json().catch(() => null);

      if (res.ok && payload?.ok) {
        toast.success("SMS de teste enviado! Verifique o telefone informado.");
      } else {
        const errorText = payload?.error || payload?.body || `HTTP ${res.status}`;
        toast.error(`Falha no teste: ${String(errorText).slice(0, 220)}`);
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
        description="Passo 1: defina aqui qual empresa e qual canal SMS serão usados pela plataforma para envio de comandos."
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
            Passo 1: escolha a empresa de envio
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
                        Essa configuração será reutilizada automaticamente na tela de Comandos e na tela de Comandos Salvos.
                      </p>
                      {provider.id === "smsdev" && (
                        <p className="text-xs text-muted-foreground mt-2">
                          O Traccar será configurado para chamar a SMS Dev diretamente no formato key, type=9, number e msg. O retorno inclui situacao, codigo, id e descricao.
                        </p>
                      )}
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
              {selectedProvider === "smsdev" && (
                <div>
                  <Label>Chave da API SMS Dev</Label>
                  <Input
                    type="password"
                    value={smsDevKey}
                    onChange={(e) => {
                      const nextKey = e.target.value;
                      setSmsDevKey(nextKey);
                      setSmsUrl(buildSmsDevDirectUrl());
                      setSmsTemplate(
                        nextKey.trim()
                          ? buildSmsDevDirectTemplate(nextKey.trim())
                          : '{"key":"{SMSDEV_KEY}","type":"9","number":"{phone}","msg":"{message}"}'
                      );
                    }}
                    placeholder="Sua chave da SMS Dev"
                    className="mt-1 font-mono text-sm"
                    autoComplete="new-password"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    A chave será enviada no body JSON da SMS Dev configurado no Traccar.
                  </p>
                </div>
              )}

              <div>
                <Label>URL do Gateway SMS</Label>
                <Textarea
                  value={displayedSmsUrl}
                  onChange={(e) => setSmsUrl(e.target.value)}
                  placeholder="https://api.provider.com/sms?phone={phone}&message={message}"
                  className="mt-1 font-mono text-sm min-h-[80px]"
                  rows={3}
                  readOnly={selectedProvider === "smsdev"}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  URL do endpoint SMS. Quando houver template, o Traccar envia POST com o body configurado abaixo.
                </p>
              </div>

              <div>
                <Label>Template do Body (POST)</Label>
                <Textarea
                  value={displayedSmsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  placeholder='{"to":"{phone}","text":"{message}"}'
                  className="mt-1 font-mono text-sm min-h-[80px]"
                  rows={3}
                  readOnly={selectedProvider === "smsdev"}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Se preenchido, a requisição será POST com este conteúdo como body. Para SMS Dev, a chave fica mascarada nesta visualização.
                </p>
              </div>

              {selectedProvider !== "smsdev" && (
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
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !(selectedProvider === "smsdev" ? smsDevKey.trim() : smsUrl)}
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
                Validar a empresa escolhida
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Faça um teste antes de seguir para a tela de Comandos. Esse é o canal que será usado nos disparos manuais e nos comandos salvos.
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
                disabled={testSending || !(selectedProvider === "smsdev" ? smsDevKey.trim() : smsUrl) || !testPhone.trim()}
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
                      A plataforma Rastrear substitui <code className="bg-muted/50 px-1 rounded text-xs">&#123;phone&#125;</code> pelo número do dispositivo e{" "}
                      <code className="bg-muted/50 px-1 rounded text-xs">&#123;message&#125;</code> pelo conteúdo do comando.
                    </li>
                    <li>
                      O número do telefone vem do campo &quot;Telefone&quot; cadastrado no dispositivo na plataforma Rastrear.
                    </li>
                    <li>
                      Para comandos SMS, o dispositivo precisa ter um número de telefone/SIM configurado.
                    </li>
                    <li>
                      Depois de salvar esta etapa, a tela de Comandos usará a empresa escolhida aqui.
                    </li>
                    <li>
                      A tela de Comandos Salvos apenas define o modelo do comando; o canal e a empresa continuam vindo desta configuração.
                    </li>
                    {selectedProvider === "smsdev" && (
                      <li>
                        Para SMS Dev, o envio fica direto no endpoint oficial da operadora, sem depender de um gateway público da plataforma.
                      </li>
                    )}
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
