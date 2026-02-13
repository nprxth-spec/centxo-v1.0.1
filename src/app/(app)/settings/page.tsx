'use client';

/**
 * Unified Settings Page
 * Consolidates all settings into a single page with tabs
 * - Account: Profile, security
 * - Team: Team members, connections  
 * - Billing: Subscription, payment
 * - Integrations: Meta, Google
 */

import { AccountSettings } from '@/components/settings/account-settings';

export default function SettingsPage() {
  // Render the existing AccountSettings component which already has tabs
  return <AccountSettings />;
}
