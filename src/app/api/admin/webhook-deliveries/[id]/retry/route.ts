// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { churchId, user } = await requireTenantContext({ requireDeveloperTools: true });
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();
    const { id } = await params;

    const { data: delivery, error: lookupError } = await supabase
      .from('webhook_deliveries')
      .select('id, delivery_id, event_id, event_type, status, webhook_id')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!delivery) {
      return NextResponse.json({ error: 'Webhook delivery not found' }, { status: 404 });
    }

    if (!['retry_scheduled', 'permanently_failed'].includes(delivery.status)) {
      return NextResponse.json({ error: 'Webhook delivery is not eligible for retry' }, { status: 409 });
    }

    const nextDeliveryId = crypto.randomUUID();

    const { error } = await serviceSupabase
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        delivery_id: nextDeliveryId,
        next_attempt_at: new Date().toISOString(),
        processing_lease_until: null,
      })
      .eq('id', id)
      .eq('church_id', churchId);

    if (error) throw error;

    await recordAuditLog({
      churchId,
      actor: user,
      action: 'webhook_delivery.retry_requested',
      resourceType: 'webhook_delivery',
      resourceDisplayId: delivery.delivery_id,
      metadata: {
        event_id: delivery.event_id,
        event_type: delivery.event_type,
        webhook_id: delivery.webhook_id,
        previous_delivery_id: delivery.delivery_id,
        retry_delivery_id: nextDeliveryId,
      },
      request,
    });

    return NextResponse.json({ data: { id, status: 'pending', delivery_id: nextDeliveryId } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
