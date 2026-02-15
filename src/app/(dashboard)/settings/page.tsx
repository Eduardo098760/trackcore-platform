'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/stores/auth';
import { useSettingsStore } from '@/lib/stores/settings';
import { Settings, User, Bell, Map, Globe, Palette, Save } from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
  const { user } = useAuthStore();
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
    setRefreshInterval
  } = useSettingsStore();

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 rounded-3xl blur-3xl"></div>
        <Card className="relative backdrop-blur-xl bg-white/80 dark:bg-gray-950/80 border-white/20 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent flex items-center gap-3">
              <Settings className="w-8 h-8 text-violet-600" />
              Configurações
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Personalize sua experiência na plataforma
            </p>
          </CardHeader>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Section */}
        <Card className="lg:col-span-1 backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Perfil do Usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarFallback className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-2xl">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {user?.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user?.email}
              </p>
              <div className="mt-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 text-xs font-semibold">
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'operator' ? 'Operador' : 'Cliente'}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input defaultValue={user?.name} className="mt-2 bg-white dark:bg-gray-900" />
              </div>
              <div>
                <Label>Email</Label>
                <Input defaultValue={user?.email} className="mt-2 bg-white dark:bg-gray-900" disabled />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input defaultValue={user?.phone} className="mt-2 bg-white dark:bg-gray-900" />
              </div>
            </div>

            <Button className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
              Atualizar Perfil
            </Button>
          </CardContent>
        </Card>

        {/* Settings Section */}
        <Card className="lg:col-span-2 backdrop-blur-xl bg-white/90 dark:bg-gray-950/90 border-white/20">
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
                <Palette className="w-5 h-5 text-violet-600" />
                Aparência
              </h3>
              
              <div className="grid gap-4">
                <div>
                  <Label>Tema</Label>
                  <Select value={theme} onValueChange={(value: any) => setTheme(value)}>
                    <SelectTrigger className="mt-2 bg-white dark:bg-gray-900">
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
                    <SelectTrigger className="mt-2 bg-white dark:bg-gray-900">
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
                <Map className="w-5 h-5 text-violet-600" />
                Configurações de Mapa
              </h3>

              <div>
                <Label>Provedor de Mapas</Label>
                <Select value={mapProvider} onValueChange={(value: any) => setMapProvider(value)}>
                  <SelectTrigger className="mt-2 bg-white dark:bg-gray-900">
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
                <Bell className="w-5 h-5 text-violet-600" />
                Notificações e Atualização
              </h3>

              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                <div>
                  <Label className="text-base">Atualização Automática</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
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
                    <SelectTrigger className="mt-2 bg-white dark:bg-gray-900">
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
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </Button>

            {saved && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  ✓ Configurações salvas com sucesso!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
