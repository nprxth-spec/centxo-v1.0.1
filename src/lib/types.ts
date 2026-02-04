export type Insight = {
  spend: number;
  messages: number;
  costPerMessage: number;
};

export type Campaign = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  dailyBudget: number;
  createdAt: string;
  insights: Insight;
};

export type Ad = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  isWinner: boolean;
  insights: Insight;
};

export type GlobalStats = {
  totalSpend: number;
  totalMessages: number;
  avgCostPerMessage: number;
  activeCampaigns: number;
};
