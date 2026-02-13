import AdBoxPageWrapper from '../adbox/page';
import { InboxRedirectToLast } from './InboxRedirectToLast';

export default async function InboxRootPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  if (params?.tab === 'settings') {
    return <AdBoxPageWrapper />;
  }
  // No slug and not settings: redirect to last inbox path (single page or multi_pages) on client
  return <InboxRedirectToLast />;
}
