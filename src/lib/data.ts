import 'server-only';
import type { Campaign, Ad, GlobalStats } from '@/lib/types';

// Mock data
const mockCampaigns: Campaign[] = [
  {
    id: 'campaign_1',
    name: 'Summer Sale 2024 - Video Test',
    status: 'ACTIVE',
    dailyBudget: 20.0,
    createdAt: '2024-07-20T10:00:00Z',
    insights: {
      spend: 15.5,
      messages: 8,
      costPerMessage: 1.94,
    },
  },
  {
    id: 'campaign_2',
    name: 'New Product Launch - Broad Targeting',
    status: 'PAUSED',
    dailyBudget: 25.0,
    createdAt: '2024-07-18T14:30:00Z',
    insights: {
      spend: 55.2,
      messages: 12,
      costPerMessage: 4.6,
    },
  },
  {
    id: 'campaign_3',
    name: 'Q3 Lead Generation',
    status: 'ACTIVE',
    dailyBudget: 20.0,
    createdAt: '2024-07-21T09:00:00Z',
    insights: {
      spend: 8.75,
      messages: 5,
      costPerMessage: 1.75,
    },
  },
];

const mockAds: { [campaignId: string]: Ad[] } = {
  campaign_1: [
    { id: 'ad_1_1', name: 'Ad Copy Variation 1', status: 'ACTIVE', isWinner: true, insights: { spend: 7.5, messages: 5, costPerMessage: 1.5 } },
    { id: 'ad_1_2', name: 'Ad Copy Variation 2', status: 'PAUSED', isWinner: false, insights: { spend: 8.0, messages: 3, costPerMessage: 2.67 } },
  ],
  campaign_2: [
    { id: 'ad_2_1', name: 'Ad Headline Test A', status: 'PAUSED', isWinner: false, insights: { spend: 30.0, messages: 5, costPerMessage: 6.0 } },
    { id: 'ad_2_2', name: 'Ad Headline Test B', status: 'PAUSED', isWinner: false, insights: { spend: 25.2, messages: 7, costPerMessage: 3.6 } },
  ],
  campaign_3: [
    { id: 'ad_3_1', name: 'AI Generated Copy 1', status: 'ACTIVE', isWinner: false, insights: { spend: 4.5, messages: 3, costPerMessage: 1.5 } },
    { id: 'ad_3_2', name: 'AI Generated Copy 2', status: 'ACTIVE', isWinner: false, insights: { spend: 4.25, messages: 2, costPerMessage: 2.13 } },
  ],
};

// Mock async data fetching functions
export async function getGlobalStats(): Promise<GlobalStats> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const totalSpend = mockCampaigns.reduce((sum, c) => sum + c.insights.spend, 0);
  const totalMessages = mockCampaigns.reduce((sum, c) => sum + c.insights.messages, 0);
  return {
    totalSpend,
    totalMessages,
    avgCostPerMessage: totalMessages > 0 ? totalSpend / totalMessages : 0,
    activeCampaigns: mockCampaigns.filter(c => c.status === 'ACTIVE').length,
  };
}

export async function getCampaigns(): Promise<Campaign[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockCampaigns;
}

export async function getCampaignById(id: string): Promise<Campaign | undefined> {
  await new Promise(resolve => setTimeout(resolve, 150));
  return mockCampaigns.find(c => c.id === id);
}

export async function getAdsForCampaign(campaignId: string): Promise<Ad[]> {
  await new Promise(resolve => setTimeout(resolve, 250));
  return mockAds[campaignId] || [];
}
