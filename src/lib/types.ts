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
  metadata: Record<string, unknown> | null;
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
  person_roles?: PersonRole[];
}

export type ListPerson = Pick<
  Person,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'status' | 'campus' | 'photo_url'
>;

export type ListTag = Pick<Tag, 'id' | 'name' | 'color'>;

export interface Role {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  created_at: string;
}

export interface PersonRole {
  id: string;
  person_id: string;
  role_id: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  role?: Role;
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

export interface WorkflowCardWithRelations extends WorkflowCard {
  workflows?: { name: string } | null;
  workflow_steps?: { name: string } | null;
}

// <!-- AGENT: FRONTEND -->
export type WorkflowPerson = Pick<
  Person,
  'id' | 'first_name' | 'last_name' | 'status' | 'created_at' | 'photo_url'
>;

export interface WorkflowBoardCard extends WorkflowCard {
  people: WorkflowPerson;
}

export interface WorkflowAdminUser {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
}

export interface WorkflowSummary extends Workflow {
  steps_count: number;
  active_cards: number;
  completed_cards: number;
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

export type SmartListRule = {
  field: string;
  op: string;
  value?: string;
};

export type SmartListFilters = {
  operator: 'AND' | 'OR';
  rules: SmartListRule[];
};

export interface ListWithCount extends List {
  member_count: number | null;
}

export interface ListPeople {
  list_id: string;
  person_id: string;
  added_at: string;
}

export interface ApiKey {
  id: string;
  church_id: string;
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
  deliveries?: WebhookDelivery[];
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

export type EventStatus = 'draft' | 'published' | 'closed';
export type RegistrationStatus = 'pending_review' | 'approved' | 'rejected';

export interface Event {
  id: string;
  church_id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  capacity: number | null;
  price: number;
  currency: string;
  payment_qr_url: string | null;
  payment_link: string | null;
  payment_instructions: string | null;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  church_id: string;
  event_id: string;
  person_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  guests: number;
  amount_due: number;
  payment_proof_url: string | null;
  paid_checkbox: boolean;
  status: RegistrationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  confirmation_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventWithStats extends Event {
  registration_count: number;
  pending_count: number;
  approved_count: number;
  spots_remaining: number | null;
}



export type PersonSummary = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  status: Person['status']
  campus: string | null
  photo_url: string | null
  tags: Array<{ id: string; name: string; color: string }>
  created_at: string
  updated_at: string
}
