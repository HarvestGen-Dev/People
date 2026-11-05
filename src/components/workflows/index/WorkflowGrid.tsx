// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { WorkflowSummary } from '@/lib/types';
import { displayIdFor } from '@/lib/display-ids';

export function WorkflowGrid({ workflows }: { workflows: WorkflowSummary[] }) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" aria-label="Workflow boards">
      {workflows.map((workflow) => (
        <li key={workflow.id} className="workspace-panel flex flex-col gap-4 p-5">
          <div className="[overflow-wrap:anywhere]">
            <h2 className="font-semibold">{workflow.name}</h2>
            {workflow.description && <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>}
          </div>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
            <div className="flex flex-row-reverse gap-1.5"><dt>steps</dt><dd className="font-semibold text-foreground">{workflow.steps_count}</dd></div>
            <div className="flex flex-row-reverse gap-1.5"><dt>open</dt><dd className="font-semibold text-foreground">{workflow.active_cards}</dd></div>
            <div className="flex flex-row-reverse gap-1.5"><dt>completed</dt><dd className="font-semibold text-foreground">{workflow.completed_cards}</dd></div>
          </dl>
          <Link href={`/workflows/${displayIdFor(workflow)}`} className="workspace-link mt-auto self-start" prefetch={false}>
            Open board <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
