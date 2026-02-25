'use client';

import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { ShieldOff } from 'lucide-react';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Protege as rotas do dashboard verificando as permissões do usuário.
 * Renderiza um painel "Acesso Negado" inline quando o caminho atual não é permitido.
 * SUPER_ADMIN sempre passa sem verificação.
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { canAccessPath, isSuperAdmin } = usePermissions();

  // Super admin nunca é bloqueado
  if (isSuperAdmin) return <>{children}</>;

  // Verifica se o caminho atual está autorizado
  if (pathname && !canAccessPath(pathname)) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[70vh] gap-6 px-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldOff className="w-12 h-12 text-red-400/70" />
          </div>
          <div className="absolute inset-0 rounded-full bg-red-500/5 blur-xl" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-100">Acesso Negado</h1>
          <p className="text-gray-400 max-w-sm leading-relaxed">
            Você não possui permissão para acessar esta página.
            Entre em contato com o administrador do sistema.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            Voltar
          </Button>
          <Button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Ir para o Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
