// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { ApiRequestError } from '@/lib/tenant-context';

type TenantReferenceTable =
  | 'people'
  | 'households'
  | 'tags'
  | 'field_definitions'
  | 'workflows'
  | 'workflow_steps'
  | 'lists'
  | 'events'
  | 'event_registrations';

function uniqueIds(ids: readonly unknown[], label: string): string[] {
  if (
    ids.some(
      (id) => typeof id !== 'string' || id.length === 0
    )
  ) {
    throw new ApiRequestError(
      `${label} must contain valid record IDs`,
      400
    );
  }

  return [...new Set(ids as readonly string[])];
}

export async function assertTenantRecords(
  table: TenantReferenceTable,
  ids: readonly unknown[],
  churchId: string,
  label: string
): Promise<void> {
  const expectedIds = uniqueIds(ids, label);
  if (expectedIds.length === 0) return;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('church_id', churchId)
    .in('id', expectedIds);

  if (error) {
    throw new Error(`Unable to validate ${label}: ${error.message}`);
  }

  const foundIds = new Set((data ?? []).map((record) => record.id));
  if (expectedIds.some((id) => !foundIds.has(id))) {
    throw new ApiRequestError(
      `One or more ${label} do not exist in the selected church`,
      400
    );
  }
}

export async function assertWorkflowStep(
  stepId: unknown,
  workflowId: unknown,
  churchId: string
): Promise<void> {
  if (typeof stepId !== 'string' || typeof workflowId !== 'string') {
    throw new ApiRequestError(
      'workflow_id and current_step_id are required',
      400
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('workflow_steps')
    .select('id')
    .eq('id', stepId)
    .eq('workflow_id', workflowId)
    .eq('church_id', churchId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate workflow step: ${error.message}`);
  }

  if (!data) {
    throw new ApiRequestError(
      'The workflow step does not belong to the selected workflow and church',
      400
    );
  }
}

export async function assertTenantAssignee(
  userId: unknown,
  churchId: string
): Promise<void> {
  if (userId === null || userId === undefined || userId === '') return;
  if (typeof userId !== 'string') {
    throw new ApiRequestError('assigned_to must be a user ID or null', 400);
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('church_memberships')
    .select('user_id')
    .eq('church_id', churchId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate assignee: ${error.message}`);
  }

  if (!data) {
    throw new ApiRequestError(
      'The assignee is not a member of the selected church',
      400
    );
  }
}

export async function assertStaticList(
  listId: string,
  churchId: string
): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('lists')
    .select('id')
    .eq('id', listId)
    .eq('church_id', churchId)
    .eq('type', 'static')
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate list: ${error.message}`);
  }

  if (!data) {
    throw new ApiRequestError(
      'The static list does not exist in the selected church',
      400
    );
  }
}
