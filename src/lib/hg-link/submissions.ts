// <!-- AGENT: BACKEND -->
import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import { formDefinitionSchema, type FormDefinition } from './formSchema';

export const FOLLOW_UP_STATUSES = ['new', 'contacted', 'in_progress', 'completed'] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];
export const STATUS_LABELS: Record<FollowUpStatus, string> = {
  new: 'New', contacted: 'Contacted', in_progress: 'In progress', completed: 'Completed',
};

export type SubmissionFilters = {
  formId?: string;
  status?: FollowUpStatus;
  assignee?: string; // user id, or 'none'
  from?: string; // YYYY-MM-DD
  to?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse untrusted query-string values into safe filters. */
export function parseFilters(raw: Record<string, string | string[] | undefined>): SubmissionFilters {
  const one = (key: string) => {
    const v = raw[key];
    return typeof v === 'string' ? v : undefined;
  };
  const filters: SubmissionFilters = {};
  const form = one('form');
  if (form && UUID.test(form)) filters.formId = form;
  const status = one('status');
  if (status && (FOLLOW_UP_STATUSES as readonly string[]).includes(status)) filters.status = status as FollowUpStatus;
  const assignee = one('assignee');
  if (assignee && (assignee === 'none' || UUID.test(assignee))) filters.assignee = assignee;
  const from = one('from');
  if (from && DATE.test(from)) filters.from = from;
  const to = one('to');
  if (to && DATE.test(to)) filters.to = to;
  return filters;
}

export type SubmissionRow = {
  id: string;
  createdAt: string;
  status: FollowUpStatus;
  assignedTo: string | null;
  formId: string;
  formTitle: string;
  workflowName: string | null;
  person: { id: string; name: string; email: string | null; phone: string | null } | null;
};

export async function listSubmissions(
  churchId: string,
  filters: SubmissionFilters,
  onlyId?: string
): Promise<SubmissionRow[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from('connect_form_submissions')
    .select('id, created_at, follow_up_status, assigned_to, form_id, person_id')
    .eq('church_id', churchId)
    .not('person_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (onlyId) query = query.eq('id', onlyId);
  if (filters.formId) query = query.eq('form_id', filters.formId);
  if (filters.status) query = query.eq('follow_up_status', filters.status);
  if (filters.assignee === 'none') query = query.is('assigned_to', null);
  else if (filters.assignee) query = query.eq('assigned_to', filters.assignee);
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00+08:00`);
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59+08:00`);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];

  const personIds = [...new Set(rows.map((r) => r.person_id as string))];
  const formIds = [...new Set(rows.map((r) => r.form_id as string))];
  const [{ data: people }, { data: forms }] = await Promise.all([
    personIds.length
      ? supabase.from('people').select('id, first_name, last_name, email, phone').eq('church_id', churchId).in('id', personIds)
      : Promise.resolve({ data: [] }),
    formIds.length
      ? supabase.from('connect_forms').select('id, title, target_workflow_id').eq('church_id', churchId).in('id', formIds)
      : Promise.resolve({ data: [] }),
  ]);
  const workflowIds = [...new Set((forms ?? []).map((f) => f.target_workflow_id as string | null).filter((v): v is string => Boolean(v)))];
  const { data: workflows } = workflowIds.length
    ? await supabase.from('workflows').select('id, name').eq('church_id', churchId).in('id', workflowIds)
    : { data: [] };

  const peopleById = new Map((people ?? []).map((p) => [p.id as string, p]));
  const formsById = new Map((forms ?? []).map((f) => [f.id as string, f]));
  const workflowsById = new Map((workflows ?? []).map((w) => [w.id as string, w.name as string]));

  return rows.map((r) => {
    const person = peopleById.get(r.person_id as string);
    const form = formsById.get(r.form_id as string);
    return {
      id: r.id as string,
      createdAt: r.created_at as string,
      status: r.follow_up_status as FollowUpStatus,
      assignedTo: (r.assigned_to as string | null) ?? null,
      formId: r.form_id as string,
      formTitle: (form?.title as string | undefined) ?? 'Form',
      workflowName: form?.target_workflow_id ? workflowsById.get(form.target_workflow_id as string) ?? null : null,
      person: person
        ? { id: person.id as string, name: `${person.first_name} ${person.last_name}`.trim(), email: (person.email as string | null) ?? null, phone: (person.phone as string | null) ?? null }
        : null,
    };
  });
}

export type SubmissionDetail = SubmissionRow & {
  answers: { label: string; value: string }[];
  formVersion: number | null;
};

export async function getSubmission(churchId: string, id: string): Promise<SubmissionDetail | null> {
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('connect_form_submissions')
    .select('id, answers, form_version')
    .eq('id', id)
    .eq('church_id', churchId)
    .maybeSingle();
  if (!row) return null;
  const [base] = await listSubmissions(churchId, {}, id);
  if (!base) return null;

  const { data: form } = await supabase
    .from('connect_forms')
    .select('definition')
    .eq('id', base.formId)
    .eq('church_id', churchId)
    .maybeSingle();
  const parsed = form?.definition ? formDefinitionSchema.safeParse(form.definition) : null;
  const definition: FormDefinition | null = parsed?.success ? parsed.data : null;

  const { data: lists } = await supabase.from('lists').select('id, name').eq('church_id', churchId);
  const listNames = new Map((lists ?? []).map((l) => [l.id as string, l.name as string]));

  const answers = Object.entries((row.answers ?? {}) as Record<string, unknown>).map(([key, value]) => {
    const field = definition?.fields.find((f) => f.id === key);
    const labelFor = (v: string) =>
      field?.optionsSource === 'lists' ? listNames.get(v) ?? v : field?.options.find((o) => o.value === v)?.label ?? v;
    const text = Array.isArray(value)
      ? value.map((v) => labelFor(String(v))).join(', ') || '—'
      : typeof value === 'boolean'
        ? (value ? 'Yes' : 'No')
        : labelFor(String(value));
    return { label: field?.label ?? key, value: text };
  });

  return { ...base, answers, formVersion: (row.form_version as number | null) ?? null };
}
