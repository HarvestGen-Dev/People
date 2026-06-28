export type ApiResponse<T> = { data: T } | { error: string };

export interface Household {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  birthdate: string | null;
  marital_status: 'single' | 'married' | 'divorced' | 'widowed' | null;
  anniversary: string | null;
  photo_url: string | null;
  status: 'active' | 'visitor' | 'inactive' | 'child';
  campus: string | null;
  household_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldDefinition {
  id: string;
  name: string;
  slug: string;
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options: string[] | null;
  is_required: boolean;
  position: number;
  created_at: string;
}

export interface PersonFieldValue {
  id: string;
  person_id: string;
  field_definition_id: string;
  value: string | null;
  created_at: string;
  updated_at: string;
  field_definition?: FieldDefinition;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface PersonTag {
  person_id: string;
  tag_id: string;
  created_at: string;
  tag?: Tag;
}

export interface PersonWithRelations extends Person {
  household?: Household | null;
  person_tags?: PersonTag[];
  person_field_values?: PersonFieldValue[];
}

export interface Note {
  id: string;
  person_id: string;
  content: string;
  category: 'general' | 'pastoral' | 'prayer' | 'follow_up' | 'visit';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonEvent {
  id: string;
  person_id: string;
  source: 'shepherd' | 'drip_brew' | 'manual' | 'people';
  event_type: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface WorkflowCard {
  id: string;
  person_id: string;
  workflow_id: string;
  current_step_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface List {
  id: string;
  name: string;
  type: 'smart' | 'static';
  filters: unknown | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListPeople {
  list_id: string;
  person_id: string;
  added_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  error_message: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  created_at: string;
}
