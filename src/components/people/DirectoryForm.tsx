'use client';

// <!-- AGENT: FRONTEND -->
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { startNavigationProgress } from '@/lib/navigation-progress';

export function DirectoryForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const tag = searchParams.get('tag') ?? '';
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function syncControls(params: URLSearchParams, keepFocused = false) {
    const form = formRef.current;
    if (!form) return;
    for (const name of ['search', 'status', 'tag']) {
      const control = form.elements.namedItem(name);
      if (keepFocused && control === document.activeElement) continue;
      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
        control.value = params.get(name) ?? '';
      }
    }
  }

  useEffect(() => {
    // A prior search response can arrive while the user is still typing.
    syncControls(new URLSearchParams({ search, status, tag }), true);
  }, [search, status, tag]);

  useEffect(() => {
    function restoreFilters() {
      clearTimeout(timer.current);
      syncControls(new URLSearchParams(window.location.search));
    }
    window.addEventListener('popstate', restoreFilters);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('popstate', restoreFilters);
    };
  }, []);

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
    <form ref={formRef} action="/people" method="get" role="search" aria-label="People directory" className="directory-toolbar"
      onClick={(event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (event.target instanceof Element && event.target.closest('[data-clear-filters]')) {
          clearTimeout(timer.current);
          syncControls(new URLSearchParams());
        }
      }}
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
