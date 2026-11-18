'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { HgLinkCard, HgLinkContent } from '@/lib/hg-link/contentSchema';
import { CARD_THEME_STYLES } from '@/components/hg-link/theme';
import { cn } from '@/lib/utils';
import { CardEditor } from './CardEditor';
import { ConfirmDialog } from './ConfirmDialog';

interface CardsPanelProps {
  content: HgLinkContent;
  forms: { slug: string; title: string }[];
  onChange: (next: HgLinkContent) => void;
}

function newCard(forms: CardsPanelProps['forms']): HgLinkCard {
  return {
    id: `card-${Math.random().toString(36).slice(2, 10)}`,
    title: 'New card',
    description: '',
    icon: 'none',
    theme: 'sand',
    buttonLabel: '',
    visible: true,
    destination: forms[0] ? { type: 'form', formSlug: forms[0].slug } : { type: 'external', url: 'https://' },
  };
}

export function CardsPanel({ content, forms, onChange }: CardsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<HgLinkCard | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const cards = content.cards;

  const setCards = (next: HgLinkCard[]) => onChange({ ...content, cards: next });
  const update = (card: HgLinkCard) => setCards(cards.map((c) => (c.id === card.id ? card : c)));
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[index], next[target]] = [next[target], next[index]];
    setCards(next);
    setAnnouncement(`${cards[index].title} moved to position ${target + 1} of ${cards.length}`);
  };
  const add = () => {
    const card = newCard(forms);
    setCards([...cards, card]);
    setEditingId(card.id);
  };

  return (
    <section aria-labelledby="cards-heading" className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="cards-heading" className="text-base font-semibold">Cards</h2>
        <Button size="sm" variant="outline" onClick={add}><Plus /> Add card</Button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      {cards.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No cards yet. Add a card to give visitors a link.</p>
      )}

      <ul className="space-y-2">
        {cards.map((card, index) => (
          <li key={card.id} className="rounded-lg border">
            <div className="flex items-center gap-2 p-2">
              <span aria-hidden="true" className={cn('size-3 shrink-0 rounded-full border', CARD_THEME_STYLES[card.theme].swatch)} />
              <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', !card.visible && 'text-muted-foreground line-through')}>
                {card.title || 'Untitled card'}
              </span>
              <Switch checked={card.visible} aria-label={`${card.visible ? 'Hide' : 'Show'} ${card.title}`}
                onCheckedChange={(visible) => update({ ...card, visible })} />
              <Button size="icon" variant="ghost" aria-label={`Move ${card.title} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
              <Button size="icon" variant="ghost" aria-label={`Move ${card.title} down`} disabled={index === cards.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
              <Button size="icon" variant="ghost" aria-label={`Edit ${card.title}`} aria-expanded={editingId === card.id}
                onClick={() => setEditingId(editingId === card.id ? null : card.id)}><Pencil /></Button>
              <Button size="icon" variant="ghost" aria-label={`Delete ${card.title}`} onClick={() => setDeleting(card)}><Trash2 /></Button>
            </div>
            {editingId === card.id && <CardEditor card={card} forms={forms} onChange={update} />}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.title ?? ''}”?`}
        description="The card is removed from your draft. It only disappears from the live page once you publish."
        confirmLabel="Delete card"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) setCards(cards.filter((c) => c.id !== deleting.id));
          setDeleting(null);
        }}
      />
    </section>
  );
}
