import { NextResponse } from 'next/server';
import { approveRegistration } from '@/lib/events/approve-registration';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function POST(request: Request) {
  try {
    const { churchId, user } = await requireTenantContext({
      requireManager: true,
    });

    const body = await request.json();
    const ids: string[] = body.ids || [];
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    let approved = 0;
    let failed = 0;

    for (const id of ids) {
      const result = await approveRegistration(id, churchId, {
        userId: user.id,
        email: user.email ?? null,
      });
      if (result.success) approved++;
      else failed++;
    }

    return NextResponse.json({ data: { approved, failed } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
