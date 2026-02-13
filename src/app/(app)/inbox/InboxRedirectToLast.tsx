'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * When user lands on /inbox (no slug), redirect to their last inbox path
 * (e.g. /inbox/King.DW16 or /inbox/multi_pages) so switching pages doesn't reset to multi_pages.
 */
export function InboxRedirectToLast() {
  const router = useRouter();
  useEffect(() => {
    const last = typeof window !== 'undefined' ? sessionStorage.getItem('inbox_last_slug') : null;
    const path = last ? `/inbox/${last}` : '/inbox/multi_pages';
    router.replace(path);
  }, [router]);
  return null;
}
