'use client';

// <!-- AGENT: FRONTEND -->
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { startNavigationProgress } from '@/lib/navigation-progress';

export function DirectoryForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function submit(form: HTMLFormElement, replace: boolean) {
    clearTimeout(timer.current);
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      if (typeof value === 'string' && value.trim()) params.set(name, value.trim());
    }
    const href = params.size ? `/people?${params}` : '/people';
    if (href === location.pathname + location.search) return;
    startNavigationProgress();
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  return (
    <form action="/people" method="get" role="search" aria-label="People directory" className="directory-toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget, false);
      }}
      onChange={(event: FormEvent<HTMLFormElement>) => {
        const form = event.currentTarget;
        clearTimeout(timer.current);
        if (event.target instanceof HTMLSelectElement) submit(form, false);
        else timer.current = setTimeout(() => submit(form, true), 300);
      }}>
      {children}
    </form>
  );
}
