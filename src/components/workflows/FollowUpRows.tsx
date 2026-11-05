// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { displayIdFor } from '@/lib/display-ids';
import { formatAddedDate } from '@/components/people/PersonIdentity';
import { CompleteFollowUp } from './CompleteFollowUp';

export type FollowUp = {
  id: string;
  due_date: string | null;
  completed_at?: string | null;
  people: { id: string; display_id: string; first_name: string; last_name: string };
  workflow_steps: { name: string } | null;
  workflows: { id: string; display_id: string; name: string };
};

export function FollowUpRows({ cards, canComplete, focusTarget, overdueOnly = false }: {
  cards: FollowUp[]; canComplete: boolean; focusTarget: string; overdueOnly?: boolean;
}) {
  return (
    <ul className="workspace-rows">
      {cards.map((card) => {
        const name = `${card.people.first_name} ${card.people.last_name}`;
        const date = card.completed_at || card.due_date;
        return (
          <li key={card.id} className="workspace-row">
            {!card.completed_at && canComplete && <CompleteFollowUp id={card.id} name={name} focusTarget={focusTarget} />}
            <div className="workspace-row-content">
              <Link href={`/workflows/${displayIdFor(card.workflows)}`} prefetch={false} className="workspace-row-link">{name}</Link>
              <p>{card.workflows.name}{card.workflow_steps ? ` · ${card.workflow_steps.name}` : ''}</p>
            </div>
            <span className={overdueOnly ? 'workspace-attention' : 'text-xs text-muted-foreground'}>
              {date ? `${card.completed_at ? 'Completed' : 'Due'} ${formatAddedDate(date)}` : 'No due date'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
