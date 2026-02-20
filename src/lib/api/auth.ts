import { AuthResponse, User, Organization } from '@/types';
import { api } from './client';
import { getOrganizationBySlug } from './organizations';

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

  const user: User = await response.json();
  
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

  return response.json();
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
