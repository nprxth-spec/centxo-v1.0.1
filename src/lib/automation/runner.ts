import type { TokenInfo } from '@/lib/facebook/token-helper';
import { getValidTokenForAdAccount } from '@/lib/facebook/token-helper';

export type CampaignRow = {
  id: string;
  name: string;
  adAccountId: string;
  status: string;
  effectiveStatus: string;
  metrics: {
    spend: number;
    messages: number;
    impressions: number;
    reach: number;
    clicks: number;
    costPerMessage: number;
  };
};

type Condition = { metric: string; op: string; value: number };

export function evaluateCondition(condition: Condition, metrics: CampaignRow['metrics']): boolean {
  const v = (metrics as any)[condition.metric];
  const num = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  const target = condition.value;
  switch (condition.op) {
    case 'gt':
      return num > target;
    case 'gte':
      return num >= target;
    case 'lt':
      return num < target;
    case 'lte':
      return num <= target;
    case 'eq':
      return num === target;
    default:
      return false;
  }
}

export async function pauseCampaign(campaignId: string, token: string): Promise<boolean> {
  const url = `https://graph.facebook.com/v22.0/${campaignId}`;
  const body = new URLSearchParams({ status: 'PAUSED', access_token: token });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.ok;
}

const INSIGHTS_TR = 'date_preset(last_30d)';

async function fetchCampaignsPage(url: string): Promise<{ data: any[]; next: string | null }> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(json.error?.message || 'Meta API error');
  if (!res.ok) throw new Error(`Meta API ${res.status}`);
  const data = Array.isArray(json.data) ? json.data : [];
  const next = typeof json.paging?.next === 'string' ? json.paging.next : null;
  return { data, next };
}

export async function fetchCampaignsForRunner(
  adAccountIds: string[],
  tokens: TokenInfo[]
): Promise<CampaignRow[]> {
  const out: CampaignRow[] = [];

  for (const accountId of adAccountIds) {
    const token = await getValidTokenForAdAccount(accountId, tokens);
    if (!token) continue;

    let url: string | null = `https://graph.facebook.com/v22.0/${accountId}/campaigns?fields=id,name,status,effective_status,insights.${INSIGHTS_TR}{spend,actions,reach,impressions,clicks}&limit=200&access_token=${token}`;

    while (url) {
      const { data, next } = await fetchCampaignsPage(url);
      for (const c of data) {
        const insights = c.insights?.data?.[0];
        const msgAction = insights?.actions?.find(
          (a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
        );
        const messages = parseInt(msgAction?.value || '0', 10);
        const spend = parseFloat(insights?.spend || '0');
        const reach = parseInt(insights?.reach || '0', 10);
        const impressions = parseInt(insights?.impressions || '0', 10);
        const clicks = parseInt(insights?.clicks || '0', 10);
        const costPerMessage = messages > 0 ? spend / messages : 0;

        out.push({
          id: c.id,
          name: c.name || c.id,
          adAccountId: accountId,
          status: c.status,
          effectiveStatus: c.effective_status || c.status,
          metrics: {
            spend,
            messages,
            impressions,
            reach,
            clicks,
            costPerMessage,
          },
        });
      }
      url = next;
    }
  }

  return out;
}
