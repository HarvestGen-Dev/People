import React from 'react';

interface TopbarProps {
  title: string;
  children?: React.ReactNode;
}

export function Topbar({ title, children }: TopbarProps) {
  return (
    <div className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/88 px-5 py-3 backdrop-blur-xl sm:px-8">
      <h1 className="text-lg font-bold tracking-[-0.02em] text-slate-950">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        {children}
      </div>
    </div>
  );
}
