'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { cn } from '@/lib/utils';

interface SignOutButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function SignOutButton({ children, className, ...props }: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isLoading}
      className={cn(className, isLoading && 'opacity-50 cursor-not-allowed')}
      {...props}
    >
      {children}
    </button>
  );
}
