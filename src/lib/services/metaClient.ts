/**
 * Meta Marketing API Client
 * Handles all interactions with Facebook/Meta Marketing API
 */

import crypto from 'crypto';

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Encryption for storing tokens
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

// Validate encryption key in production
if (process.env.NODE_ENV === 'production' && ENCRYPTION_KEY === 'default-key-change-in-production') {
  throw new Error(
    '❌ CRITICAL SECURITY ERROR: ENCRYPTION_KEY is using default value in production!\n' +
    'Generate a secure key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
    'Then set it in your environment variables.'
  );
}

if (ENCRYPTION_KEY.length < 32) {
  console.warn('⚠️ WARNING: ENCRYPTION_KEY should be at least 32 characters for optimal security');
}

// Derive a proper 32-byte key using PBKDF2 (more secure than padding)
const DERIVED_KEY = crypto.pbkdf2Sync(
  ENCRYPTION_KEY,
  'centxo-salt-v1', // Static salt (app-level)
  100000,           // Iterations
  32,               // Key length
  'sha256'
);

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', DERIVED_KEY, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Legacy key for backward compatibility with existing tokens
const LEGACY_KEY = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));

export function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted token format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];

  // Try new PBKDF2-derived key first
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', DERIVED_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // Fallback to legacy key for backward compatibility
    const decipher = crypto.createDecipheriv('aes-256-cbc', LEGACY_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

interface MetaAPIError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id: string;
}

class MetaAPIClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${GRAPH_API_BASE}${normalizedEndpoint}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const doFetch = (): Promise<Response> => {
      if (method === 'GET') {
        const params = new URLSearchParams({
          access_token: this.accessToken,
          ...data,
        });
        return fetch(`${url}?${params}`);
      }
      const body = { access_token: this.accessToken, ...data };
      options.body = JSON.stringify(body);
      return fetch(url, options);
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await doFetch();
      if (response.ok) return this.handleResponse(response);
      const retriable = response.status >= 500 || response.status === 429;
      if (attempt < 1 && retriable) {
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      return this.handleResponse(response);
    }

    throw new Error('Meta API request failed');
  }

  private async handleResponse(response: Response) {
    const json = await response.json();

    if (!response.ok) {
      const error = json.error as MetaAPIError;
      throw new Error(
        `Meta API Error: ${error.message} (Code: ${error.code}, Type: ${error.type})`
      );
    }

    return json;
  }

  // Public method for generic GET requests
  async get(endpoint: string, params?: any) {
    return this.makeRequest(endpoint, 'GET', params);
  }

  // Get user's ad accounts
  async getAdAccounts(userId: string) {
    return this.makeRequest(`/${userId}/adaccounts`, 'GET', {
      fields: 'id,name,account_status,currency,timezone_name',
    });
  }

  // Get pages user can manage
  async getPages(userId: string) {
    return this.makeRequest(`/${userId}/accounts`, 'GET', {
      fields: 'id,name,access_token,tasks',
    });
  }

  // Search details for interests/targeting
  async searchInterests(query: string) {
    return this.makeRequest(`/search`, 'GET', {
      type: 'adtarget',
      q: query,
      target_class: 'interests',
    });
  }

  // Upload video to Meta
  async uploadVideo(adAccountId: string, videoUrl: string, title: string) {
    return this.makeRequest(`/${adAccountId}/advideos`, 'POST', {
      file_url: videoUrl,
      name: title,
    });
  }

  // Create Campaign
  async createCampaign(
    adAccountId: string,
    name: string,
    objective: 'MESSAGES' | 'OUTCOME_TRAFFIC' = 'MESSAGES',
    status: 'PAUSED' | 'ACTIVE' = 'PAUSED'
  ) {
    return this.makeRequest(`/${adAccountId}/campaigns`, 'POST', {
      name,
      objective,
      status,
      special_ad_categories: [],
    });
  }

  // Create Ad Set with Messages objective
  async createAdSet(params: {
    campaignId: string;
    name: string;
    dailyBudget: number; // in cents
    targeting: any;
    bidStrategy?: string;
    optimizationGoal?: string;
    billingEvent?: string;
    status?: 'PAUSED' | 'ACTIVE';
    pageId: string; // Required for Messages objective
  }) {
    const {
      campaignId,
      name,
      dailyBudget,
      targeting,
      bidStrategy = 'LOWEST_COST_WITHOUT_CAP',
      optimizationGoal = 'CONVERSATIONS',
      billingEvent = 'IMPRESSIONS',
      status = 'PAUSED',
      pageId,
    } = params;

    return this.makeRequest(`/act_${params.campaignId.split('_')[1]}/adsets`, 'POST', {
      campaign_id: campaignId,
      name,
      daily_budget: dailyBudget,
      bid_strategy: bidStrategy,
      optimization_goal: optimizationGoal,
      billing_event: billingEvent,
      targeting,
      status,
      promoted_object: {
        page_id: pageId,
      },
      payer_id: pageId, // Required for regulated ads (benefit payer)
    });
  }

  // Create Ad Creative for Messages
  async createAdCreative(params: {
    adAccountId: string;
    name: string;
    pageId: string;
    videoId: string;
    message: string;
    link?: string;
  }) {
    const { adAccountId, name, pageId, videoId, message, link } = params;

    const payload = {
      name,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          message,
          link: link || `https://m.me/${pageId}`,
          video_id: videoId,
          call_to_action: {
            type: 'MESSAGE_PAGE',
          },
        },
      },
    };

    console.log('🎨 Creating Ad Creative with payload:', JSON.stringify(payload, null, 2));

    return this.makeRequest(`/${adAccountId}/adcreatives`, 'POST', payload);
  }

  // Create Ad
  async createAd(params: {
    adSetId: string;
    adAccountId: string;
    name: string;
    creativeId: string;
    status?: 'PAUSED' | 'ACTIVE';
  }) {
    const { adSetId, adAccountId, name, creativeId, status = 'PAUSED' } = params;

    return this.makeRequest(`/${adAccountId}/ads`, 'POST', {
      adset_id: adSetId,
      name,
      creative: { creative_id: creativeId },
      status,
    });
  }

  // Update Campaign Status
  async updateCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
    return this.makeRequest(`/${campaignId}`, 'POST', {
      status,
    });
  }

  // Update Ad Status
  async updateAdStatus(adId: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
    return this.makeRequest(`/${adId}`, 'POST', {
      status,
    });
  }

  // Get Campaign Insights
  async getCampaignInsights(campaignId: string, datePreset: string = 'today') {
    return this.makeRequest(`/${campaignId}/insights`, 'GET', {
      fields: 'campaign_id,campaign_name,spend,actions,action_values,cost_per_action_type',
      date_preset: datePreset,
      time_increment: 1,
    });
  }

  // Get Ad Insights
  async getAdInsights(adId: string, datePreset: string = 'today') {
    return this.makeRequest(`/${adId}/insights`, 'GET', {
      fields: 'ad_id,ad_name,spend,actions,action_values,cost_per_action_type',
      date_preset: datePreset,
      time_increment: 1,
    });
  }

  // Get AdSet Insights
  async getAdSetInsights(adSetId: string, datePreset: string = 'today') {
    return this.makeRequest(`/${adSetId}/insights`, 'GET', {
      fields: 'adset_id,adset_name,spend,actions,action_values,cost_per_action_type',
      date_preset: datePreset,
      time_increment: 1,
    });
  }

  // Batch get insights for multiple entities
  async getBatchInsights(entityIds: string[], entityType: 'campaign' | 'adset' | 'ad') {
    const promises = entityIds.map((id) => {
      switch (entityType) {
        case 'campaign':
          return this.getCampaignInsights(id);
        case 'adset':
          return this.getAdSetInsights(id);
        case 'ad':
          return this.getAdInsights(id);
      }
    });

    return Promise.allSettled(promises);
  }
}

// Helper function to create targeting for Thailand
export function createThailandTargeting(minAge: number = 20) {
  return {
    geo_locations: {
      countries: ['TH'],
    },
    age_min: minAge,
    locales: [22, 6], // Thai (22), English (6)
    publisher_platforms: ['facebook', 'instagram', 'messenger'],
    facebook_positions: ['feed', 'story', 'video_feeds', 'marketplace'],
    instagram_positions: ['stream', 'story', 'explore'],
    messenger_positions: ['messenger_home', 'story'],
    device_platforms: ['mobile', 'desktop'],
  };
}

// Extract message count from insights
export function extractMessageCount(insights: any): number {
  if (!insights.data || insights.data.length === 0) return 0;

  const actions = insights.data[0].actions;
  if (!actions) return 0;

  const messageAction = actions.find(
    (action: any) => action.action_type === 'onsite_conversion.messaging_conversation_started_7d'
  );

  return messageAction ? parseInt(messageAction.value, 10) : 0;
}

// Calculate cost per message
export function calculateCostPerMessage(spend: number, messages: number): number | null {
  if (messages === 0) return null;
  return spend / messages;
}

export default MetaAPIClient;
