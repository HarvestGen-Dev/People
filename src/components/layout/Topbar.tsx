import React from 'react';

interface TopbarProps {
  title: string;
  children?: React.ReactNode;
}

export function Topbar({ title, children }: TopbarProps) {
  return (
    <div className="sticky top-0 z-20 flex min-h-16 min-w-0 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/88 px-5 py-3 backdrop-blur-xl sm:px-8">
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-[-0.02em] text-slate-950">
        {title}
      </h1>
      <div className="flex min-w-0 max-w-full items-center gap-2">
        {children}
      </div>
    </div>
  );
}
