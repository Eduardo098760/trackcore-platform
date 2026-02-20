import { NextRequest, NextResponse } from 'next/server';
import type { Organization } from '@/types';
import { getOrganizations } from '@/lib/api/organizations';

/**
 * Middleware para identificar o tenant baseado em:
 * 1. Subdomínio (tenant.trackcore.com)
 * 2. Custom domain (cliente.com.br)
 * 3. Header X-Tenant-ID (para APIs)
 * 4. Query param ?tenant=slug (fallback)
 */

// Cache de organizações (atualizado periodicamente)
let organizationsCache: Organization[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getOrganizationsCache(): Promise<Organization[]> {
  const now = Date.now();
  
  // Se cache está vazio ou expirado, recarregar
  if (organizationsCache.length === 0 || now - lastCacheUpdate > CACHE_TTL) {
    try {
      organizationsCache = await getOrganizations();
      lastCacheUpdate = now;
    } catch (error) {
      console.error('Error loading organizations cache:', error);
      // Se falhar, manter cache anterior
    }
  }
  
  return organizationsCache;
}

export async function getTenantFromRequest(request: NextRequest): Promise<Organization | null> {
  const hostname = request.headers.get('host') || '';
  const tenantHeader = request.headers.get('x-tenant-id');
  const url = new URL(request.url);
  const tenantQuery = url.searchParams.get('tenant');

  // Carregar organizações
  const organizations = await getOrganizationsCache();

  // 1. Check X-Tenant-ID header (priority for API calls)
  if (tenantHeader) {
    const org = organizations.find(o => o.id === parseInt(tenantHeader));
    if (org) return org;
  }

  // 2. Check subdomain (tenant.trackcore.com)
  const subdomain = hostname.split('.')[0];
  if (subdomain && subdomain !== 'www' && subdomain !== 'localhost') {
    const org = organizations.find(o => o.slug === subdomain);
    if (org) return org;
  }

  // 3. Check custom domain
  const org = organizations.find(o => o.domain === hostname);
  if (org) return org;

  // 4. Check query parameter
  if (tenantQuery) {
    const org = organizations.find(o => o.slug === tenantQuery);
    if (org) return org;
  }

  // Default: return first organization (for development)
  return organizations[0] || null;
}

export function validateTenantAccess(
  organization: Organization | null,
  userId?: number
): boolean {
  if (!organization) return false;
  
  // Check if organization is active
  if (organization.status !== 'active' && organization.status !== 'trial') {
    return false;
  }

  // Additional validations can be added here
  return true;
}
