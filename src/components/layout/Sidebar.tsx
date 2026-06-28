'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Users, 
  LayoutList, 
  GitBranch, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { label: 'Users', href: '/people', icon: Users },
  { label: 'List', href: '/lists', icon: LayoutList },
  { label: 'Workflow', href: '/workflows', icon: GitBranch },
  { separator: true },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      } else {
        router.push('/login');
      }
    };
    fetchUser();
  }, [supabase.auth, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className={`flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-200 shrink-0 ${isCollapsed ? 'w-16' : 'w-60'}`}>
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-teal-500 font-bold text-white text-xs">
            HG
          </div>
          {!isCollapsed && <span className="font-semibold text-white tracking-tight">People</span>}
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navItems.map((item, index) => {
          if (item.separator) {
            return <div key={`sep-${index}`} className="my-2 border-t border-slate-800" />;
          }

          const Icon = item.icon!;
          const isActive = pathname.startsWith(item.href!);
          
          const linkClasses = `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isActive 
              ? 'bg-slate-700 text-white' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          } ${isCollapsed ? 'justify-center' : ''}`;

          const content = (
            <Link href={item.href!} className={linkClasses}>
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger>
                  {content}
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-4">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.label}>{content}</div>;
        })}
      </nav>

      <div className="border-t border-slate-800 p-2 shrink-0">
        <div className={`flex items-center gap-3 rounded-md px-3 py-2 ${isCollapsed ? 'justify-center' : ''}`}>
          <Avatar className="h-8 w-8 bg-teal-500 text-white">
            <AvatarFallback className="bg-teal-500 text-white">
              {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-white">{userEmail}</span>
            </div>
          )}
          {!isCollapsed && (
            <button 
              onClick={handleSignOut}
              className="text-slate-400 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
        {isCollapsed && (
          <div className="mt-2 flex justify-center">
            <button 
              onClick={handleSignOut}
              className="text-slate-400 hover:text-white transition-colors p-2"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 p-2 flex justify-center shrink-0">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
