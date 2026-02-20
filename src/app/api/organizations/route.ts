import { NextRequest, NextResponse } from 'next/server';
import { getOrganizations, createOrganization } from '@/lib/api/organizations';

export async function GET(request: NextRequest) {
  try {
    const organizations = await getOrganizations();
    return NextResponse.json(organizations);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Create organization using real Traccar API
    const newOrg = await createOrganization({
      name: body.name,
      slug: body.slug,
      domain: body.domain,
      settings: {
        maxDevices: body.maxDevices || 50,
        maxUsers: body.maxUsers || 10,
        features: body.features || ['basic', 'reports', 'geofences']
      },
      status: body.status || 'active',
      plan: body.plan || 'professional'
    });

    return NextResponse.json(newOrg, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
