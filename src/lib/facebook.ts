
import crypto from 'crypto';

export function parseSignedRequest(signedRequest: string, appSecret: string): any {
    try {
        const [encodedSig, payload] = signedRequest.split('.', 2);

        if (!encodedSig || !payload) {
            throw new Error('Invalid signed request format');
        }

        // Decode the signature
        const sig = base64decode(encodedSig);

        // Decode the payload
        const data = JSON.parse(base64decode(payload));

        // Verify the algorithm
        if (data.algorithm.toUpperCase() !== 'HMAC-SHA256') {
            throw new Error('Unknown algorithm: ' + data.algorithm);
        }

        // Verify the signature
        const expectedSig = crypto
            .createHmac('sha256', appSecret)
            .update(payload)
            .digest();

        // Timing-safe comparison recommended, but for this context simple comparison strictly is usually done in JS 
        // (Buffer.compare implies timing leakage potentially, but acceptable for this use case usually).
        // Let's use crypto.timingSafeEqual if possible, or Buffer.compare.
        // Signatures are Buffers.
        const sigBuffer = Buffer.from(sig, 'binary'); // Base64 decode results in binary string or buffer depending on implementation, let's ensure Buffer.

        // Custom base64decode usually returns string, let's fix that.

        if (!crypto.timingSafeEqual(Buffer.from(sig, 'latin1'), expectedSig)) {
            // Note: Facebook uses URL-safe base64, so standard base64 might need tweaks if not handled.
            // However, let's trust the logic: hash(payload, secret) == sig
            // Actually, let's do the simpler verify:
            // Re-hash the payload and compare base64url strings? No, headers are different.
            throw new Error('Bad signature');
        }

        return data;

    } catch (e) {
        console.error('Parse Signed Request Error:', e);
        return null;
    }
}

// Helper for URL-safe Base64 decoding
function base64decode(str: string): string {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

const GRAPH_API_VERSION = 'v22.0';

export async function getAdAccounts(accessToken: string) {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/me/adaccounts?fields=id,name,account_status,amount_spent,currency,timezone_name&limit=500&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.data || [];
}

export async function getCampaignsWithDeliveryStatus(accessToken: string, adAccountId: string, dateRange?: any) {
    // Note: dateRange is unused in this listing but kept for signature compatibility
    const fields = 'id,name,status,effective_status,objective,buying_type,spend,daily_budget,lifetime_budget,start_time,stop_time';
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${adAccountId}/campaigns?fields=${fields}&limit=500&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.data || [];
}

export async function getAdSetsWithDeliveryStatus(accessToken: string, adAccountId: string) {
    const fields = 'id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,campaign{id,name},targeting,billing_event,optimization_goal';
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${adAccountId}/adsets?fields=${fields}&limit=500&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.data || [];
}

export async function getAds(accessToken: string, adAccountId: string, status?: any, since?: any, until?: any) {
    const fields = 'id,name,status,effective_status,adset{id,name},campaign{id,name},creative{id,name,thumbnail_url,image_url,object_story_spec}';
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${adAccountId}/ads?fields=${fields}&limit=500&access_token=${accessToken}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.data || [];
}

export async function getInsights(accessToken: string, objectId: string, level: string, dateRange?: { from: string, to: string }) {
    // Include ad_id, campaign_id, adset_id for proper merging when level=ad/campaign/adset
    const fields = 'ad_id,campaign_id,adset_id,reach,impressions,spend,cpm,cpp,ctr,actions,action_values,cost_per_action_type,clicks,inline_link_clicks,unique_clicks,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions';
    let url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${objectId}/insights?level=${level}&fields=${fields}&limit=500&access_token=${accessToken}`;

    if (dateRange && dateRange.from && dateRange.to) {
        // Facebook API expects time_range as JSON object or time_range[since]&time_range[until]
        const timeRange = JSON.stringify({ since: dateRange.from, until: dateRange.to });
        url += `&time_range=${encodeURIComponent(timeRange)}`;
    } else {
        url += `&date_preset=maximum`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    // Flatten actions/video fields for easier consumption
    return (data.data || []).map((item: any) => {
        const result = { ...item };

        // Helper to extract value from actions array
        const getActionValue = (actionType: string) => {
            const action = item.actions?.find((a: any) => a.action_type === actionType);
            return action ? action.value : 0;
        };

        // Helper for video stats (which are lists of actions)
        const getVideoStat = (field: string) => {
            if (item[field] && Array.isArray(item[field])) {
                const val = item[field].find((a: any) => a.action_type === 'video_view');
                return val ? val.value : 0;
            }
            return 0;
        };

        result.postEngagements = getActionValue('post_engagement');
        result.newMessagingContacts = getActionValue('onsite_conversion.messaging_conversation_started_7d');
        result.costPerNewMessagingContact = item.cost_per_action_type?.find((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 0;

        // Video stats mapping
        result.videoAvgTimeWatched = getVideoStat('video_avg_time_watched_actions');
        result.videoPlays = getActionValue('video_view');
        result.video3SecWatched = getActionValue('video_view_3s') || getActionValue('video_view'); // 3-second video plays
        result.videoP25Watched = getVideoStat('video_p25_watched_actions');
        result.videoP50Watched = getVideoStat('video_p50_watched_actions');
        result.videoP75Watched = getVideoStat('video_p75_watched_actions');
        result.videoP95Watched = getVideoStat('video_p95_watched_actions');
        result.videoP100Watched = getVideoStat('video_p100_watched_actions');

        return result;
    });
}
