import { redirect } from 'next/navigation';

export default function AdsManagerPage() {
  // Redirect to campaigns page which has tabs for campaigns, adsets, and ads
  // Note: This will be handled by middleware which redirects /ads-manager to /ads-manager/campaigns
  redirect('/ads-manager/campaigns');
}
