import { ReactNode } from 'react';

export default function PublicEventLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1">
        {children}
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border mt-auto">
        Powered by <span className="font-semibold text-primary">HarvestGen People</span>
      </footer>
    </div>
  );
}
