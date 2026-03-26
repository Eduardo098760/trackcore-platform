import { AuthResponse, User, Organization } from "@/types";
import { api } from "./client";
import { getOrganizationBySlug } from "./organizations";

/** Retorna headers extras para multi-tenant (servidor dinâmico) */
function getServerHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const server = localStorage.getItem("traccar-server");
    if (server && /^https?:\/\//i.test(server)) {
      return { "x-traccar-server": server };
    }
  } catch {}
  return {};
}

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
  if (traccarUser?.administrator) return "admin";

  // 2 & 3. Role salva em attributes (novo modelo ou retrocompatibilidade)
  const savedRole = traccarUser?.attributes?.role as string | undefined;
  const newRoles = ["admin", "manager", "user", "readonly", "deviceReadonly"];
  const oldToNew: Record<string, string> = {
    superadmin: "admin",
    operator: "user",
    client: "readonly",
  };
  if (savedRole) {
    if (newRoles.includes(savedRole)) return savedRole;
    if (oldToNew[savedRole]) return oldToNew[savedRole];
  }

  // 4. Campo nativo Traccar: readonly
  if (traccarUser?.readonly) return "readonly";

  // 5. Campo nativo Traccar: deviceReadonly
  if (traccarUser?.deviceReadonly) return "deviceReadonly";

  // 6. Manager: userLimit diferente de 0 (gerente no Traccar)
  if (traccarUser?.userLimit != null && traccarUser.userLimit !== 0)
    return "manager";

  return "user";
}

function applyRole(traccarUser: any): User {
  const rawLogin = traccarUser.login && traccarUser.login !== "false" ? traccarUser.login : null;
  return {
    ...traccarUser,
    role: mapTraccarRole(traccarUser),
    lastLogin: traccarUser.attributes?.lastLogin || rawLogin || null,
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
  organizationSlug?: string,
): Promise<AuthResponse> {
  // Limpa sessão anterior para evitar "Duplicate sessions" no Traccar (Jetty)
  try {
    await fetch(`${api.getConfig().baseURL}/session`, {
      method: "DELETE",
      credentials: "include",
      headers: { ...getServerHeader() },
    });
  } catch {
    // Ignora erro se não havia sessão ativa
  }

  // Traccar usa form-encoded data para login
  const formData = new URLSearchParams();
  formData.append("email", email);
  formData.append("password", password);

  const response = await fetch(`${api.getConfig().baseURL}/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...getServerHeader(),
    },
    credentials: "include",
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error("Credenciais inválidas");
  }

  const rawUser = await response.json();
  const user: User = applyRole(rawUser);

  // Registrar lastLogin nos attributes do Traccar
  try {
    const now = new Date().toISOString();
    const updatedAttributes = { ...(rawUser.attributes || {}), lastLogin: now };
    await fetch(`${api.getConfig().baseURL}/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getServerHeader() },
      credentials: "include",
      body: JSON.stringify({ ...rawUser, attributes: updatedAttributes }),
    });
    user.lastLogin = now;
  } catch (e) {
    console.warn("[auth] Falha ao salvar lastLogin:", e);
  }

  // Validate user belongs to the organization (if specified)
  let organization: Organization | undefined;
  if (organizationSlug) {
    organization = (await getOrganizationBySlug(organizationSlug)) || undefined;

    if (organization) {
      // Check if user belongs to this organization
      const userOrgId = user.organizationId;
      if (userOrgId !== organization.id && user.role !== "admin") {
        throw new Error("Usuário não pertence a esta organização");
      }
    }
  }

  // Traccar não retorna token JWT, usa sessão baseada em cookie
  // Geramos um token fake para compatibilidade com o sistema existente
  const token = btoa(
    JSON.stringify({
      userId: user.id,
      email: user.email,
      organizationId: organization?.id,
    }),
  );

  return {
    user,
    token,
    organization,
  };
}

/**
 * Obtém o usuário atual da sessão do Traccar
 */
export async function getCurrentUser(): Promise<User> {
  const response = await fetch(`${api.getConfig().baseURL}/session`, {
    credentials: "include",
    headers: { ...getServerHeader() },
  });

  if (!response.ok) {
    throw new Error("Não autenticado");
  }

  const raw = await response.json();
  return applyRole(raw);
}

/**
 * Faz logout da sessão do Traccar
 */
export async function logout(): Promise<void> {
  await fetch(`${api.getConfig().baseURL}/session`, {
    method: "DELETE",
    credentials: "include",
    headers: { ...getServerHeader() },
  });
}

/**
 * Solicita reset de senha (se o Traccar tiver esse endpoint configurado)
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // Traccar não tem endpoint padrão de reset de senha
  // Isso depende da configuração customizada
  console.log(`Password reset requested for ${email}`);
  throw new Error("Funcionalidade não disponível no Traccar");
}
