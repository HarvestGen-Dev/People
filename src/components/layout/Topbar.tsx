import React from 'react';

interface TopbarProps {
  title: string;
  children?: React.ReactNode;
}

export function Topbar({ title, children }: TopbarProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6 shrink-0">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        {children}
      </div>
    </div>
  );
}
