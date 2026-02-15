'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  status?: number;
  ok?: boolean;
  body?: string;
  error?: string;
  duration?: number;
  note?: string;
}

export default function TestPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const runTests = async () => {
    setLoading(true);
    setResults([]);
    const newResults: TestResult[] = [];

    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromISO = from.toISOString();
    const toISO = now.toISOString();

    try {
      const loginStart = Date.now();
      const loginFormData = new URLSearchParams({
        email,
        password,
      });

      const loginRes = await fetch('/api/traccar/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        credentials: 'include',
        body: loginFormData.toString(),
      });

      const loginDuration = Date.now() - loginStart;
      const loginBody = await loginRes.text();

      newResults.push({
        name: 'Login',
        endpoint: '/session (POST)',
        method: 'POST',
        status: loginRes.status,
        ok: loginRes.ok,
        body: loginBody.substring(0, 300),
        duration: loginDuration,
      });

      if (!loginRes.ok) {
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);

        const endpoints = [
          { name: 'Dispositivos', method: 'GET', path: '/devices' },
          { name: 'Posicoes', method: 'GET', path: '/positions' },
          { name: 'Usuario Atual', method: 'GET', path: '/session' },
          { name: 'Grupos', method: 'GET', path: '/groups' },
          { name: 'Geofences', method: 'GET', path: '/geofences' },
          { name: 'Comandos', method: 'GET', path: '/commands' },
          { name: 'Notificacoes', method: 'GET', path: '/notifications' },
          { name: 'Drivers', method: 'GET', path: '/drivers' },
          { name: 'Relatorio de Eventos', method: 'GET', path: `/reports/events?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`, note: 'Com datas dos ultimos 30 dias' },
          { name: 'Estatisticas', method: 'GET', path: `/statistics?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`, note: 'Com datas dos ultimos 30 dias' },
          { name: 'Atributos Computados', method: 'GET', path: '/attributes/computed?all=true', note: 'Rota corrigida: /attributes/computed' },
        ];

        for (const endpoint of endpoints) {
          const start = Date.now();
          try {
            const res = await fetch(`/api/traccar${endpoint.path}`, {
              method: endpoint.method,
              credentials: 'include',
            });
            const duration = Date.now() - start;
            const body = await res.text();

            newResults.push({
              name: endpoint.name,
              endpoint: endpoint.path,
              method: endpoint.method,
              status: res.status,
              ok: res.ok,
              body: body.substring(0, 500),
              duration,
              note: endpoint.note,
            });

          } catch (e: any) {
            newResults.push({
              name: endpoint.name,
              endpoint: endpoint.path,
              method: endpoint.method,
              error: e.message,
              note: endpoint.note,
            });
          }
        }
      }
    } catch (error: any) {
      newResults.push({
        name: 'Erro Geral',
        endpoint: 'N/A',
        method: 'N/A',
        error: error.message,
      });
    }

    setResults(newResults);
    setLoading(false);
  };

  useEffect(() => {
    setTimeout(() => {
      runTests();
    }, 500);
  }, []);

  const successCount = results.filter((r) => r.ok).length;
  const errorCount = results.filter((r) => !r.ok && !r.error).length;
  const exceptionCount = results.filter((r) => r.error).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Teste de Endpoints
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Teste de autenticacao e endpoints da plataforma Traccar
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{results.length}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                Sucesso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {successCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
                Erro HTTP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {errorCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">
                Excecao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                {exceptionCount}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuracoes</CardTitle>
            <CardDescription>Defina as credenciais e execute os testes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  disabled={loading}
                />
              </div>
            </div>
            <Button
              onClick={runTests}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Testando...' : 'Executar Testes'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Resultados</h2>
          {results.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  Clique em "Executar Testes" para comcar
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {results.map((result, i) => (
                <Card
                  key={i}
                  className={`border-l-4 ${
                    result.error
                      ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : result.ok
                        ? 'border-l-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">
                          {result.error ? 'Error' : result.ok ? 'OK' : 'FAIL'}
                        </span>
                        <div className="flex-1">
                          <CardTitle className="text-base">{result.name}</CardTitle>
                          <CardDescription className="text-xs font-mono break-all">
                            {result.method} {result.endpoint}
                          </CardDescription>
                          {result.note && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                              {result.note}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {result.status && (
                          <div
                            className={`text-sm font-bold ${
                              result.ok
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            {result.status}
                          </div>
                        )}
                        {result.duration && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {result.duration}ms
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {(result.body || result.error) && (
                    <CardContent>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-auto max-h-[200px] font-mono">
                        {result.error || result.body}
                      </pre>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Correcoes Aplicadas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-gray-600 dark:text-gray-400">
            <p>OK - Removido: GET /events (nao existe na API)</p>
            <p>OK - Adicionado: Parametros from/to para relatorios e estatisticas</p>
            <p>OK - Corrigido: /attributes para /attributes/computed?all=true</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status da Integracao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <span>{isAuthenticated ? '[ONLINE]' : '[OFFLINE]'}</span>
              <span>
                Autenticacao: <strong>{isAuthenticated ? 'Conectado' : 'Desconectado'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{successCount > 0 ? '[OK]' : '[FAIL]'}</span>
              <span>
                Endpoints: <strong>{successCount}/{results.length - 1} funcionando</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}