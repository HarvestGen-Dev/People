'use client';

// <!-- AGENT: FRONTEND -->
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { TopLoadingBar } from '@/components/layout/TopLoadingBar';
import { NAVIGATION_PROGRESS_START_EVENT } from '@/lib/navigation-progress';

const MIN_VISIBLE_MS = 250;
const MAX_VISIBLE_MS = 8000;
type TimerId = number | null;

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

function getSameAppUrl(url: string | URL | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const nextUrl = new URL(String(url), window.location.href);
    return nextUrl.origin === window.location.origin ? nextUrl : null;
  } catch {
    return null;
  }
}

function changesRoute(nextUrl: URL) {
  return (
    nextUrl.pathname !== window.location.pathname ||
    nextUrl.search !== window.location.search
  );
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const startedAtRef = useRef(0);
  const completeTimerRef = useRef<TimerId>(null);
  const fallbackTimerRef = useRef<TimerId>(null);

  const clearTimer = useCallback(
    (timerRef: MutableRefObject<TimerId>) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    []
  );

  const start = useCallback(() => {
    clearTimer(completeTimerRef);
    startedAtRef.current = Date.now();
    setIsLoading(true);

    clearTimer(fallbackTimerRef);
    fallbackTimerRef.current = window.setTimeout(() => {
      setIsLoading(false);
      fallbackTimerRef.current = null;
    }, MAX_VISIBLE_MS);
  }, [clearTimer]);

  const complete = useCallback(() => {
    if (!startedAtRef.current) {
      return;
    }

    const visibleFor = Date.now() - startedAtRef.current;
    const remaining = Math.max(MIN_VISIBLE_MS - visibleFor, 0);

    clearTimer(completeTimerRef);
    completeTimerRef.current = window.setTimeout(() => {
      clearTimer(fallbackTimerRef);
      startedAtRef.current = 0;
      setIsLoading(false);
      completeTimerRef.current = null;
    }, remaining);
  }, [clearTimer]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        isModifiedClick(event)
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (
        !anchor ||
        (anchor.target && anchor.target !== '_self') ||
        anchor.hasAttribute('download') ||
        anchor.getAttribute('rel')?.includes('external')
      ) {
        return;
      }

      const nextUrl = getSameAppUrl(anchor.href);
      if (nextUrl && changesRoute(nextUrl)) {
        start();
        window.setTimeout(() => {
          if (event.defaultPrevented) {
            complete();
          }
        }, 0);
      }
    };

    const handlePopState = () => start();
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(data, unused, url) {
      const nextUrl = getSameAppUrl(url);
      if (nextUrl && changesRoute(nextUrl)) {
        start();
      }
      return originalPushState.apply(this, [data, unused, url]);
    };

    window.history.replaceState = function replaceState(data, unused, url) {
      const nextUrl = getSameAppUrl(url);
      if (nextUrl && changesRoute(nextUrl)) {
        start();
      }
      return originalReplaceState.apply(this, [data, unused, url]);
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener(NAVIGATION_PROGRESS_START_EVENT, start);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pageshow', complete);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener(NAVIGATION_PROGRESS_START_EVENT, start);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pageshow', complete);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      clearTimer(completeTimerRef);
      clearTimer(fallbackTimerRef);
    };
  }, [clearTimer, complete, start]);

  useEffect(() => {
    complete();
  }, [pathname, searchParams, complete]);

  return isLoading ? <TopLoadingBar /> : null;
}
