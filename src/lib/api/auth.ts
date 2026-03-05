import { AuthResponse, User, Organization } from '@/types';
import { api } from './client';
import { getOrganizationBySlug } from './organizations';

/**
 * Extrai a role correta do usuário Traccar alinhada ao modelo nativo:
 *
 *   Prioridade de detecção:
 *   1. administrator: true           → 'admin'
 *   2. attributes.role (novo modelo) → 'admin'|'manager'|'user'|'readonly'|'deviceReadonly'
 *   3. attributes.role (retrocompat) → 'superadmin'→'admin' | 'operator'→'user' | 'client'→'readonly'
 *   4. readonly: true                → 'readonly'
 *   5. deviceReadonly: true          → 'deviceReadonly'
 *   6. userLimit != 0                → 'manager'
 *   7. fallback                      → 'user'
 */
function mapTraccarRole(traccarUser: any): string {
  // 1. Campo nativo Traccar: administrator
  if (traccarUser?.administrator) return 'admin';

  // 2 & 3. Role salva em attributes (novo modelo ou retrocompatibilidade)
  const savedRole = traccarUser?.attributes?.role as string | undefined;
  const newRoles = ['admin', 'manager', 'user', 'readonly', 'deviceReadonly'];
  const oldToNew: Record<string, string> = {
    superadmin: 'admin',
    operator:   'user',
    client:     'readonly',
  };
  if (savedRole) {
    if (newRoles.includes(savedRole)) return savedRole;
    if (oldToNew[savedRole]) return oldToNew[savedRole];
  }

  // 4. Campo nativo Traccar: readonly
  if (traccarUser?.readonly) return 'readonly';

  // 5. Campo nativo Traccar: deviceReadonly
  if (traccarUser?.deviceReadonly) return 'deviceReadonly';

  // 6. Manager: userLimit diferente de 0 (gerente no Traccar)
  if (traccarUser?.userLimit != null && traccarUser.userLimit !== 0) return 'manager';

  return 'user';
}

function applyRole(traccarUser: any): User {
  return {
    ...traccarUser,
    role: mapTraccarRole(traccarUser),
  } as User;
}

/**
 * Faz login no Traccar usando email e senha
 * O Traccar usa autenticação baseada em sessão (cookie)
 * Agora com suporte multi-tenant
 */
export async function login(
  email: string, 
  password: string, 
  organizationSlug?: string
): Promise<AuthResponse> {
  // Traccar usa form-encoded data para login
  const formData = new URLSearchParams();
  formData.append('email', email);
  formData.append('password', password);

  const response = await fetch(`${api.getConfig().baseURL}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    credentials: 'include', // Important: include cookies
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error('Credenciais inválidas');
  }

  const rawUser = await response.json();
  const user: User = applyRole(rawUser);
  
  // Validate user belongs to the organization (if specified)
  let organization: Organization | undefined;
  if (organizationSlug) {
    organization = await getOrganizationBySlug(organizationSlug) || undefined;
    
    if (organization) {
      // Check if user belongs to this organization
      const userOrgId = user.organizationId || user.attributes?.organizationId;
      if (userOrgId !== organization.id && user.role !== 'superadmin') {
        throw new Error('Usuário não pertence a esta organização');
      }
    }
  }
  
  // Traccar não retorna token JWT, usa sessão baseada em cookie
  // Geramos um token fake para compatibilidade com o sistema existente
  const token = btoa(JSON.stringify({ 
    userId: user.id, 
    email: user.email,
    organizationId: organization?.id 
  }));
  
  return {
    user,
    token,
    organization
  };
}

/**
 * Obtém o usuário atual da sessão do Traccar
 */
export async function getCurrentUser(): Promise<User> {
  const response = await fetch(`${api.getConfig().baseURL}/session`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Não autenticado');
  }

  const raw = await response.json();
  return applyRole(raw);
}

/**
 * Faz logout da sessão do Traccar
 */
export async function logout(): Promise<void> {
  await fetch(`${api.getConfig().baseURL}/session`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

/**
 * Solicita reset de senha (se o Traccar tiver esse endpoint configurado)
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // Traccar não tem endpoint padrão de reset de senha
  // Isso depende da configuração customizada
  console.log(`Password reset requested for ${email}`);
  throw new Error('Funcionalidade não disponível no Traccar');
}
