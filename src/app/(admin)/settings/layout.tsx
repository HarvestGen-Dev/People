'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Topbar } from '@/components/layout/Topbar';

const settingsNav = [
  { name: 'General', href: '/settings' },
  { name: 'Custom fields', href: '/settings/fields' },
  { name: 'Tags', href: '/settings/tags' },
  { name: 'API keys', href: '/settings/api-keys' },
  { name: 'Webhooks', href: '/settings/webhooks' },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 overflow-hidden">
        {/* Subnav Sidebar */}
        <div className="w-48 sm:w-60 border-r border-border bg-white flex flex-col pt-4 overflow-y-auto">
          <div className="px-4 mb-4">
            <h2 className="text-lg font-bold text-slate-900">Settings</h2>
          </div>
          <nav className="flex-1 px-2 space-y-1">
            {settingsNav.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm rounded-lg transition-colors border-r-2 border-transparent",
                    isActive 
                      ? "bg-teal-50 text-teal-700 font-medium border-teal-600 rounded-r-none" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
