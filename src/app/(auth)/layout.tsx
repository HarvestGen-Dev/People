import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
      <div className="mb-8 flex items-center justify-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 font-bold text-white">
          HG
        </div>
        <span className="text-2xl font-semibold tracking-tight text-white">People</span>
      </div>
      {children}
    </div>
  );
}
