'use client';

/**
 * CampaignsContent - Embeds the full campaigns management functionality
 * This re-exports the existing CampaignsPage directly for full functionality
 */

// Import the existing campaigns page directly - it handles all state management internally
import CampaignsPage from '@/app/(app)/ads-manager/campaigns/page';

export default function CampaignsContent() {
  // Render the original campaigns page directly within this container
  // The page handles its own loading, state, and error handling
  return <CampaignsPage />;
}
