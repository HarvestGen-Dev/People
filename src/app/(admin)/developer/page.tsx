// <!-- AGENT: INTEGRATION -->
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Braces,
  KeyRound,
  LockKeyhole,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Developer API | People',
};

const endpoints = [
  {
    method: 'GET',
    path: '/api/v1/people',
    scope: 'people:read',
    description: 'List people with pagination and optional search or status filters.',
  },
  {
    method: 'POST',
    path: '/api/v1/people',
    scope: 'people:write',
    description: 'Create a person in the API key’s church.',
  },
  {
    method: 'GET',
    path: '/api/v1/people/{person_id}',
    scope: 'people:read',
    description: 'Read one person, including tags and custom fields.',
  },
  {
    method: 'PATCH',
    path: '/api/v1/people/{person_id}',
    scope: 'people:write',
    description: 'Update an existing person.',
  },
  {
    method: 'POST',
    path: '/api/v1/people/lookup',
    scope: 'people:lookup',
    description: 'Match by email or phone, or create a visitor when no match exists.',
  },
  {
    method: 'GET',
    path: '/api/v1/people/{person_id}/events',
    scope: 'events:read',
    description: 'Read a person’s integration activity timeline.',
  },
  {
    method: 'POST',
    path: '/api/v1/events',
    scope: 'events:write',
    description: 'Append a Shepherd or Drip & Brew event to a person’s timeline.',
  },
];

const lookupExample = `curl -X POST "$PEOPLE_URL/api/v1/people/lookup" \\
  -H "Authorization: Bearer $PEOPLE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "visitor@example.com",
    "phone": "+60123456789",
    "first_name": "Avery",
    "last_name": "Tan",
    "source": "shepherd"
  }'`;

const responseExample = `{
  "data": {
    "found": true,
    "person": {
      "id": "PER-7F3A91C2B0",
      "first_name": "Avery",
      "last_name": "Tan",
      "status": "visitor"
    }
  }
}`;

export default async function DeveloperPage() {
  const { churchName } = await requireTenantContext({ requireManager: true });

  return (
    <>
      <Topbar title="Developer API" />
      <div className="mx-auto max-w-6xl space-y-10 p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
              Integration reference
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Developer API
            </h1>
            <p className="mt-2 max-w-2xl text-slate-500">
              Connect trusted systems to {churchName} with tenant-scoped credentials.
            </p>
          </div>
          <Link
            href="/settings/api-keys"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <KeyRound className="h-4 w-4" />
            Manage API keys
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: LockKeyhole,
              title: 'Bearer authentication',
              body: 'Send the API key in the Authorization header on every request.',
            },
            {
              icon: ShieldCheck,
              title: 'Tenant isolation',
              body: 'The key selects its church automatically. Never send a church ID.',
            },
            {
              icon: Braces,
              title: 'JSON requests',
              body: 'Write endpoints accept JSON and return JSON response envelopes.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-bold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-700" />
              <h2 className="font-bold text-slate-950">Available endpoints</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Grant only the scopes an integration needs.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {endpoints.map((endpoint) => (
              <div
                key={`${endpoint.method}-${endpoint.path}`}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[5rem_minmax(0,1fr)_8rem] sm:items-center sm:px-6"
              >
                <span className={`w-fit rounded-lg px-2.5 py-1 text-xs font-bold ${
                  endpoint.method === 'GET'
                    ? 'bg-sky-100 text-sky-700'
                    : endpoint.method === 'PATCH'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {endpoint.method}
                </span>
                <div className="min-w-0">
                  <code className="break-all text-sm font-semibold text-slate-800">
                    {endpoint.path}
                  </code>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {endpoint.description}
                  </p>
                </div>
                <code className="w-fit rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                  {endpoint.scope}
                </code>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <Send className="h-4 w-4 text-emerald-700" />
              <h2 className="font-bold text-slate-950">Lookup request</h2>
            </div>
            <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-5 text-xs leading-6 text-slate-200">
              <code>{lookupExample}</code>
            </pre>
          </div>
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <Braces className="h-4 w-4 text-emerald-700" />
              <h2 className="font-bold text-slate-950">Success response</h2>
            </div>
            <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-5 text-xs leading-6 text-slate-200">
              <code>{responseExample}</code>
            </pre>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <h2 className="font-bold text-emerald-950">Identity conflict handling</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-800">
            Lookup returns HTTP 409 with code <code className="rounded bg-white/70 px-1.5 py-0.5">identity_conflict</code> when
            a phone matches multiple people or when email and phone identify different people.
            Stop the sync and send the record for human review.
          </p>
          <Link
            href="/settings/webhooks"
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 hover:text-emerald-950"
          >
            Configure outbound webhooks
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </>
  );
}
