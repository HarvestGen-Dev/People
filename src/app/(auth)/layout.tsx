import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
      <div className="mb-8 flex items-center justify-center gap-3">
        <span className="text-3xl font-bold tracking-tight text-foreground font-[Helvetica,Arial,sans-serif]">Harvest Generation</span>
      </div>
      {children}
    </div>
  );
}
