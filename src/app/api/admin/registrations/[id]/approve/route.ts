import { NextResponse } from 'next/server';
import { approveRegistration } from '@/lib/events/approve-registration';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId, user } = await requireTenantContext({
      requireManager: true,
    });

    const { id } = await params;
    
    // Call the shared approval logic
    const result = await approveRegistration(id, churchId, {
      userId: user.id,
      email: user.email ?? null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
