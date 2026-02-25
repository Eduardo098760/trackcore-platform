'use client';

/**
 * useImpersonation
 *
 * Hook que gerencia o ciclo completo de impersonação segura:
 *
 *   loginAs(targetUser)
 *     1. POST /api/admin/impersonate — valida admin server-side, cria cookie HttpOnly
 *     2. Audit log no cliente (localStorage)
 *     3. Atualiza Zustand store (preserva snapshot do admin)
 *     4. Limpa cache do React Query
 *     5. Redireciona para /splash (que faz prefetch dos dados do cliente)
 *
 *   returnToAdmin()
 *     1. DELETE /api/admin/impersonate — remove cookie HttpOnly, audit log server-side
 *     2. Audit log no cliente
 *     3. Restaura admin no Zustand
 *     4. Limpa cache do React Query
 *     5. Redireciona para /users
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth';
import { useAuditStore } from '@/lib/stores/audit';
import type { User } from '@/types';

export function useImpersonation() {
  const router           = useRouter();
  const queryClient      = useQueryClient();
  const addAuditEvent    = useAuditStore((s) => s.addEvent);
  const [loading, setLoading] = useState(false);

  const {
    user:             currentUser,
    isImpersonating,
    adminSnapshot,
    startImpersonation,
    stopImpersonation,
  } = useAuthStore();

  // ── loginAs ────────────────────────────────────────────────────────────────
  const loginAs = async (targetUser: User): Promise<void> => {
    setLoading(true);
    try {
      // 1. Validação server-side + criação de cookie HttpOnly assinado
      const res = await fetch('/api/admin/impersonate', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ targetUser }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? 'Erro ao iniciar impersonação');
      }

      // 2. Audit log no cliente (complementa o log server-side)
      const admin = useAuthStore.getState().user;
      if (admin) {
        addAuditEvent({
          type:       'IMPERSONATION_START',
          actorId:    admin.id,
          actorName:  admin.name,
          actorEmail: admin.email,
          targetId:   targetUser.id,
          targetName: targetUser.name,
          targetEmail: targetUser.email,
        });
      }

      // 3. Atualiza Zustand store (salva snapshot do admin + ativa impersonação)
      startImpersonation(targetUser);

      // 4. Limpa TODO o cache — garante que apenas dados do cliente sejam carregados
      queryClient.clear();

      // 5. Redireciona pela splash screen (faz prefetch com userId do cliente)
      router.push('/splash');

    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao entrar como este usuário');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── returnToAdmin ──────────────────────────────────────────────────────────
  const returnToAdmin = async (): Promise<void> => {
    setLoading(true);
    try {
      // 1. Remove cookie HttpOnly + audit log server-side
      await fetch('/api/admin/impersonate', {
        method:      'DELETE',
        credentials: 'include',
      });

      // 2. Audit log no cliente
      const snap          = useAuthStore.getState().adminSnapshot;
      const impersonated  = useAuthStore.getState().user;
      if (snap?.user && impersonated) {
        addAuditEvent({
          type:       'IMPERSONATION_STOP',
          actorId:    snap.user.id,
          actorName:  snap.user.name,
          actorEmail: snap.user.email,
          targetId:   impersonated.id,
          targetName: impersonated.name,
          targetEmail: impersonated.email,
        });
      }

      // 3. Restaura admin no Zustand
      stopImpersonation();

      // 4. Limpa cache
      queryClient.clear();

      // 5. Volta para gestão de usuários
      router.push('/users');

    } catch (err) {
      console.error('[useImpersonation] returnToAdmin error:', err);
      // Mesmo com falha no servidor, restaura estado local para não travar o admin
      stopImpersonation();
      queryClient.clear();
      router.push('/users');
    } finally {
      setLoading(false);
    }
  };

  return {
    isImpersonating,
    loading,
    loginAs,
    returnToAdmin,
    /** Usuário atualmente impersonado (null se não houver impersonação) */
    impersonatedUser: isImpersonating ? currentUser : null,
    /** Admin original (mesmo durante impersonação) */
    adminUser: adminSnapshot?.user ?? (isImpersonating ? null : currentUser),
  };
}
