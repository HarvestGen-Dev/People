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
  { label: 'Developer API', href: '/developer', icon: Settings },
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
    <div className={`flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0 ${isCollapsed ? 'w-16' : 'w-60'}`}>
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-sidebar-border px-4">
        <div className="flex items-center w-full">
          {!isCollapsed ? (
            <span className="font-bold text-sidebar-foreground tracking-tight font-[Helvetica,Arial,sans-serif] text-lg truncate">Harvest Generation</span>
          ) : (
            <span className="font-bold text-sidebar-foreground tracking-tight font-[Helvetica,Arial,sans-serif] text-lg mx-auto">HG</span>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navItems.map((item, index) => {
          if (item.separator) {
            return <div key={`sep-${index}`} className="my-2 border-t border-sidebar-border" />;
          }

          const Icon = item.icon!;
          const isActive = pathname.startsWith(item.href!);
          
          const linkClasses = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
            isActive 
              ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' 
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
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

      <div className="border-t border-sidebar-border p-3 shrink-0">
        <div className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-all ${isCollapsed ? 'justify-center' : 'hover:bg-sidebar-accent/50'}`}>
          <Avatar className="h-8 w-8 bg-primary text-primary-foreground shadow-sm">
            <AvatarFallback className="bg-primary text-primary-foreground font-medium">
              {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-sidebar-foreground">{userEmail}</span>
            </div>
          )}
          {!isCollapsed && (
            <button 
              onClick={handleSignOut}
              className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
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
              className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-2 rounded-lg hover:bg-sidebar-accent"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-sidebar-border p-2 flex justify-center shrink-0">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
