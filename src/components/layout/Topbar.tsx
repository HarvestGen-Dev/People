import React from 'react';

interface TopbarProps {
  title: string;
  children?: React.ReactNode;
}

export function Topbar({ title, children }: TopbarProps) {
  return (
    <div className="flex min-h-16 min-w-0 flex-wrap items-center justify-between gap-3 border-b bg-card px-[var(--workspace-gutter)] py-3">
      <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight break-words">
        {title}
      </h1>
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );
}
