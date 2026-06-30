import React from 'react';

interface TopbarProps {
  title: string;
  children?: React.ReactNode;
}

export function Topbar({ title, children }: TopbarProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-6 shrink-0 z-10">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
      <div className="flex items-center gap-4">
        {children}
      </div>
    </div>
  );
}
