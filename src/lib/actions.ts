'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';

const launchSchema = z.object({
  pageId: z.string().min(1, 'Page is required'),
  adAccountId: z.string().min(1, 'Ad account is required'),
  adCount: z.coerce.number().min(1).max(5),
  beneficiaryName: z.string().min(1, 'Beneficiary is required for Thailand ads'),
});

export type LaunchCampaignResult = {
  success: boolean;
  error?: string;
  redirectTo?: string;
  campaignName?: string;
  campaignId?: string;
};

/**
 * Launch campaign via real /api/campaigns/create API.
 * Maps Launch Wizard form data to the full campaign create payload.
 */
export async function launchCampaign(formData: FormData): Promise<LaunchCampaignResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: 'กรุณาเข้าสู่ระบบ', redirectTo: '/login' };
  }

  const validatedFields = launchSchema.safeParse({
    pageId: formData.get('pageId'),
    adAccountId: formData.get('adAccountId'),
    adCount: formData.get('adCount'),
    beneficiaryName: formData.get('beneficiaryName'),
  });

  if (!validatedFields.success) {
    const first = validatedFields.error.errors[0];
    return { success: false, error: first?.message || 'Invalid form data.', redirectTo: '/create-ads' };
  }

  const videoFile = formData.get('videoFile') as File;
  if (!videoFile || videoFile.size === 0) {
    return { success: false, error: 'กรุณาอัปโหลดวิดีโอ', redirectTo: '/create-ads' };
  }

  const { pageId, adAccountId, adCount, beneficiaryName } = validatedFields.data;

  // Ensure act_ prefix for Meta API
  const cleanAdAccountId = String(adAccountId).startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  // Build FormData for /api/campaigns/create
  const apiFormData = new FormData();
  apiFormData.append('file', videoFile);
  apiFormData.append('mediaType', 'video');
  apiFormData.append('adAccountId', cleanAdAccountId);
  apiFormData.append('pageId', pageId);
  apiFormData.append('adsCount', String(adCount));
  apiFormData.append('adSetCount', String(Math.min(adCount, 3)));
  apiFormData.append('campaignCount', '1');
  apiFormData.append('campaignObjective', 'OUTCOME_TRAFFIC');
  apiFormData.append('targetCountry', 'TH');
  apiFormData.append('placements', 'facebook,instagram,messenger');
  apiFormData.append('ageMin', '20');
  apiFormData.append('ageMax', '50');
  apiFormData.append('beneficiaryName', beneficiaryName);
  apiFormData.append('dailyBudget', '20');

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

  try {
    const res = await fetch(`${baseUrl}/api/campaigns/create`, {
      method: 'POST',
      headers: { Cookie: cookieHeader },
      body: apiFormData,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error || `Request failed (${res.status})`;
      return { success: false, error: msg, redirectTo: '/create-ads' };
    }

    if (data.success && data.campaignId) {
      return {
        success: true,
        campaignId: data.campaignId,
        campaignName: data.message || `Campaign ${data.campaignId}`,
      };
    }

    return { success: false, error: data?.error || 'Unknown error', redirectTo: '/create-ads' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: msg, redirectTo: '/create-ads' };
  }
}
