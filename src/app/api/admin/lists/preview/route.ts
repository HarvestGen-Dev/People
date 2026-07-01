import { NextResponse } from 'next/server';
import { evaluateSmartList } from '@/lib/lists/evaluate';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function POST(request: Request) {
  try {
    const { churchId } = await requireTenantContext();

    const body = await request.json();
    if (!body.filters) return NextResponse.json({ error: 'Missing filters' }, { status: 400 });

    const evalResult = await evaluateSmartList(body.filters, churchId, { limit: 10 });

    return NextResponse.json({
      data: {
        people: evalResult.people,
        total: evalResult.total
      }
    });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
