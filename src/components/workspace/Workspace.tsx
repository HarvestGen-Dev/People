// <!-- AGENT: FRONTEND -->
import type { ReactNode } from 'react';

export function WorkspacePage({ children }: { children: ReactNode }) {
  return <div className="workspace-page">{children}</div>;
}

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="workspace-page-header">
      <div className="min-w-0">
        {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="workspace-description">{description}</p>}
      </div>
      {actions && <div className="workspace-actions">{actions}</div>}
    </header>
  );
}

export function PanelHeader({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="workspace-panel-header">
      <div className="min-w-0">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="workspace-empty"><h3>{title}</h3><p>{description}</p></div>;
}
