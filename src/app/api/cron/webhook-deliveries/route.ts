// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processWebhookDelivery, type ClaimedWebhookDelivery } from '@/lib/webhooks';

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;

function configuredSecret() {
  return process.env.WEBHOOK_WORKER_SECRET || process.env.CRON_SECRET || null;
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: Request) {
  const secret = configuredSecret();
  if (!secret) {
    console.error('[cron:webhook-deliveries] WEBHOOK_WORKER_SECRET or CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook worker is not configured' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let batchSize = DEFAULT_BATCH_SIZE;
  try {
    const body = await request.json().catch(() => null) as { batch_size?: unknown } | null;
    if (body?.batch_size !== undefined) {
      const requestedBatchSize = body.batch_size;
      if (
        typeof requestedBatchSize !== 'number' ||
        !Number.isInteger(requestedBatchSize) ||
        requestedBatchSize < 1 ||
        requestedBatchSize > MAX_BATCH_SIZE
      ) {
        return NextResponse.json({ error: 'batch_size must be an integer from 1 to 50' }, { status: 400 });
      }
      batchSize = requestedBatchSize;
    }
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('claim_webhook_deliveries', {
    p_batch_size: batchSize,
    p_lease_seconds: 60,
  });

  if (error) {
    console.error('[cron:webhook-deliveries] claim failed', error);
    return NextResponse.json({ error: 'Unable to claim webhook deliveries' }, { status: 500 });
  }

  const deliveries = (data || []) as ClaimedWebhookDelivery[];
  const summary = {
    claimed: deliveries.length,
    delivered: 0,
    retry_scheduled: 0,
    permanently_failed: 0,
  };

  for (const delivery of deliveries) {
    const result = await processWebhookDelivery(delivery);
    summary[result] += 1;
  }

  return NextResponse.json({ success: true, data: summary });
}
