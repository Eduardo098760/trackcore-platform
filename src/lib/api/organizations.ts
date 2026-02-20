import { Organization } from '@/types';
import { api } from './client';

/**
 * API functions for managing organizations (tenants)
 * Maps to Traccar's Groups as organizations and Users as members
 */

export async function getOrganizations(): Promise<Organization[]> {
  try {
    const groups = await api.get<any[]>('/groups');
    
    return groups.map(group => ({
      id: group.id,
      name: group.name,
      slug: group.attributes?.slug || group.name.toLowerCase().replace(/\s+/g, '-'),
      domain: group.attributes?.domain,
      settings: {
        maxDevices: group.attributes?.maxDevices || 50,
        maxUsers: group.attributes?.maxUsers || 10,
        features: group.attributes?.features || ['basic', 'reports', 'geofences']
      },
      traccarUserId: group.attributes?.adminUserId || group.id,
      status: group.attributes?.status || 'active',
      plan: group.attributes?.plan || 'professional',
      createdAt: group.attributes?.createdAt || new Date().toISOString(),
      updatedAt: group.attributes?.updatedAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return [];
  }
}

export async function getOrganizationById(id: number): Promise<Organization> {
  try {
    const group = await api.get<any>(`/groups/${id}`);
    
    return {
      id: group.id,
      name: group.name,
      slug: group.attributes?.slug || group.name.toLowerCase().replace(/\s+/g, '-'),
      domain: group.attributes?.domain,
      settings: {
        maxDevices: group.attributes?.maxDevices || 50,
        maxUsers: group.attributes?.maxUsers || 10,
        features: group.attributes?.features || ['basic', 'reports', 'geofences']
      },
      traccarUserId: group.attributes?.adminUserId || group.id,
      status: group.attributes?.status || 'active',
      plan: group.attributes?.plan || 'professional',
      createdAt: group.attributes?.createdAt || new Date().toISOString(),
      updatedAt: group.attributes?.updatedAt || new Date().toISOString()
    };
  } catch (error) {
    throw new Error('Organization not found');
  }
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  try {
    const orgs = await getOrganizations();
    return orgs.find(o => o.slug === slug) || null;
  } catch (error) {
    console.error('Error fetching organization by slug:', error);
    return null;
  }
}

export async function createOrganization(
  data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt' | 'traccarUserId'>
): Promise<Organization> {
  try {
    const group = await api.post<any>('/groups', {
      name: data.name,
      attributes: {
        slug: data.slug,
        domain: data.domain,
        maxDevices: data.settings.maxDevices,
        maxUsers: data.settings.maxUsers,
        features: data.settings.features,
        status: data.status,
        plan: data.plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    return {
      id: group.id,
      name: group.name,
      slug: data.slug,
      domain: data.domain,
      settings: data.settings,
      traccarUserId: group.id,
      status: data.status,
      plan: data.plan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error creating organization:', error);
    throw error;
  }
}

export async function updateOrganization(
  id: number,
  data: Partial<Organization>
): Promise<Organization> {
  try {
    const group = await api.get<any>(`/groups/${id}`);
    
    const updatedGroup = await api.put<any>(`/groups/${id}`, {
      id: group.id,
      name: data.name || group.name,
      groupId: group.groupId,
      attributes: {
        ...group.attributes,
        slug: data.slug || group.attributes?.slug,
        domain: data.domain || group.attributes?.domain,
        maxDevices: data.settings?.maxDevices || group.attributes?.maxDevices,
        maxUsers: data.settings?.maxUsers || group.attributes?.maxUsers,
        features: data.settings?.features || group.attributes?.features,
        status: data.status || group.attributes?.status,
        plan: data.plan || group.attributes?.plan,
        updatedAt: new Date().toISOString()
      }
    });

    return {
      id: updatedGroup.id,
      name: updatedGroup.name,
      slug: updatedGroup.attributes?.slug || data.slug || '',
      domain: updatedGroup.attributes?.domain,
      settings: {
        maxDevices: updatedGroup.attributes?.maxDevices || 50,
        maxUsers: updatedGroup.attributes?.maxUsers || 10,
        features: updatedGroup.attributes?.features || []
      },
      traccarUserId: updatedGroup.id,
      status: updatedGroup.attributes?.status || 'active',
      plan: updatedGroup.attributes?.plan || 'professional',
      createdAt: updatedGroup.attributes?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error updating organization:', error);
    throw error;
  }
}

export async function deleteOrganization(id: number): Promise<void> {
  try {
    await api.delete<void>(`/groups/${id}`);
  } catch (error) {
    console.error('Error deleting organization:', error);
    throw error;
  }
}

export async function getOrganizationUsers(organizationId: number): Promise<any[]> {
  try {
    const allUsers = await api.get<any[]>('/users?excludeAttributes=true');
    
    return allUsers.filter(u => 
      u.groupId === organizationId ||
      u.attributes?.organizationId === organizationId
    );
  } catch (error) {
    console.error('Error fetching organization users:', error);
    return [];
  }
}

export async function getOrganizationDevices(organizationId: number): Promise<any[]> {
  try {
    const allDevices = await api.get<any[]>('/devices');
    const orgUsers = await getOrganizationUsers(organizationId);
    const orgUserIds = orgUsers.map(u => u.id);
    
    return allDevices.filter(d => 
      d.groupId === organizationId ||
      d.attributes?.organizationId === organizationId ||
      orgUserIds.some(uid => d.userId === uid)
    );
  } catch (error) {
    console.error('Error fetching organization devices:', error);
    return [];
  }
}
