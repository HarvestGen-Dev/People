// <!-- AGENT: INTEGRATION -->
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TEST_PASSWORD } from './auth';
import {
  removeAuthUsers,
  removeChurches,
  removeRateLimitScopes,
  removeStorageObjects,
} from './cleanup';
import { createAdminClient, insertOne } from './supabase-admin';

export type TestRole =
  | 'owner'
  | 'admin'
  | 'pastoral'
  | 'workflow_manager'
  | 'staff'
  | 'viewer'
  | 'member';

export type TestUser = {
  id: string;
  email: string;
  password: string;
  role?: TestRole | 'portal';
};

export type SeededPerson = {
  id: string;
  display_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

export class E2ETenant {
  readonly admin: SupabaseClient;
  readonly suffix: string;
  readonly churchId: string;
  readonly churchName: string;
  readonly churchSlug: string;
  readonly userIds: string[] = [];
  readonly storageObjects: Array<{ bucket: string; path: string }> = [];
  readonly rateLimitScopes: string[] = [];

  private constructor(
    admin: SupabaseClient,
    suffix: string,
    church: { id: string; name: string; slug: string }
  ) {
    this.admin = admin;
    this.suffix = suffix;
    this.churchId = church.id;
    this.churchName = church.name;
    this.churchSlug = church.slug;
  }

  static async create(label: string) {
    const admin = createAdminClient();
    const suffix = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
    const slugLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const church = await insertOne<{ id: string; name: string; slug: string }>(
      admin,
      'churches',
      {
        name: `${label} ${suffix}`,
        slug: `${slugLabel}-${suffix}`,
      },
      'id, name, slug'
    );
    return new E2ETenant(admin, suffix, church);
  }

  unique(label: string) {
    return `${label}-${this.suffix}`;
  }

  async createUser(role: TestRole, label: string = role): Promise<TestUser> {
    const authUser = await this.createAuthUser(label);
    await insertOne(this.admin, 'church_memberships', {
      church_id: this.churchId,
      user_id: authUser.id,
      role,
    });
    return { ...authUser, role };
  }

  async createAuthUser(label = 'account'): Promise<TestUser> {
    const email = `${label}-${this.suffix}@test.invalid`;
    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Unable to seed Auth user: ${error.message}`);
    this.userIds.push(data.user.id);
    return { id: data.user.id, email, password: TEST_PASSWORD };
  }

  async createPortalUser(person: SeededPerson, label = 'portal'): Promise<TestUser> {
    const email = `${label}-${this.suffix}@test.invalid`;
    const { data, error } = await this.admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Unable to seed portal Auth user: ${error.message}`);
    this.userIds.push(data.user.id);
    await insertOne(this.admin, 'person_user_links', {
      church_id: this.churchId,
      person_id: person.id,
      user_id: data.user.id,
      claim_method: 'admin_approved',
    });
    return { id: data.user.id, email, password: TEST_PASSWORD, role: 'portal' };
  }

  async createPerson(values: Partial<Record<string, unknown>> = {}): Promise<SeededPerson> {
    const firstName = String(values.first_name ?? 'Synthetic');
    const lastName = String(values.last_name ?? `Person ${this.suffix}`);
    return insertOne<SeededPerson>(
      this.admin,
      'people',
      {
        church_id: this.churchId,
        first_name: firstName,
        last_name: lastName,
        email: values.email ?? `${crypto.randomUUID()}@test.invalid`,
        phone: values.phone ?? null,
        status: values.status ?? 'visitor',
        campus: values.campus ?? 'Synthetic Campus',
        allow_self_claim: values.allow_self_claim ?? false,
        ...values,
      },
      'id, display_id, first_name, last_name, email'
    );
  }

  async createWorkflow(name = `Workflow ${this.suffix}`, stepNames = ['New', 'Contacted']) {
    const workflow = await insertOne<{ id: string; display_id: string; name: string }>(
      this.admin,
      'workflows',
      {
        church_id: this.churchId,
        name,
        description: 'Synthetic E2E workflow',
        is_active: true,
      },
      'id, display_id, name'
    );
    const steps = [];
    for (const [index, stepName] of stepNames.entries()) {
      steps.push(
        await insertOne<{ id: string; name: string; position: number }>(
          this.admin,
          'workflow_steps',
          {
            church_id: this.churchId,
            workflow_id: workflow.id,
            name: stepName,
            position: (index + 1) * 1000,
            default_days_to_complete: 3,
          },
          'id, name, position'
        )
      );
    }
    return { ...workflow, steps };
  }

  async createTag(name = `Tag ${this.suffix}`) {
    return insertOne<{ id: string; display_id: string; name: string }>(
      this.admin,
      'tags',
      { church_id: this.churchId, name, color: '#047857' },
      'id, display_id, name'
    );
  }

  async createEvent(values: Partial<Record<string, unknown>> = {}) {
    const slug = String(values.slug ?? `event-${this.suffix}-${crypto.randomBytes(3).toString('hex')}`);
    const event = await insertOne<{
      id: string;
      display_id: string;
      slug: string;
      name: string;
      price: number;
    }>(
      this.admin,
      'events',
      {
        church_id: this.churchId,
        slug,
        name: values.name ?? `Synthetic Event ${this.suffix}`,
        description: values.description ?? 'Synthetic event used only by the local E2E suite.',
        location: values.location ?? 'Synthetic Hall',
        start_at: values.start_at ?? new Date(Date.now() + 86_400_000).toISOString(),
        capacity: values.capacity ?? 20,
        price: values.price ?? 0,
        currency: 'MYR',
        status: values.status ?? 'published',
        payment_instructions: values.payment_instructions ?? null,
        ...values,
      },
      'id, display_id, slug, name, price'
    );
    this.rateLimitScopes.push(event.id);
    return event;
  }

  async createConnectForm(values: {
    title?: string;
    description?: string;
    targetTagId?: string;
    targetWorkflowId?: string;
  } = {}) {
    const slug = `connect-${this.suffix}-${crypto.randomBytes(3).toString('hex')}`;
    const form = await insertOne<{ id: string; slug: string; title: string }>(
      this.admin,
      'connect_forms',
      {
        church_id: this.churchId,
        slug,
        title: values.title ?? `Connect ${this.suffix}`,
        description: values.description ?? 'Synthetic local E2E connect form.',
        target_tag_id: values.targetTagId ?? null,
        target_workflow_id: values.targetWorkflowId ?? null,
        is_active: true,
      },
      'id, slug, title'
    );
    this.rateLimitScopes.push(slug);
    return form;
  }

  trackStorage(bucket: string, path: string) {
    this.storageObjects.push({ bucket, path });
  }

  async cleanup() {
    await removeStorageObjects(this.admin, this.storageObjects);
    await removeRateLimitScopes(this.admin, this.rateLimitScopes);
    removeChurches([this.churchId]);
    await removeAuthUsers(this.admin, this.userIds);
  }
}

export async function cleanupTenants(tenants: E2ETenant[]) {
  const errors: Error[] = [];
  for (const tenant of tenants) {
    try {
      await tenant.cleanup();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.message).join('\n'));
  }
}
