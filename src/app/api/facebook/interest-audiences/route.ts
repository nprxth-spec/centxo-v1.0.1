import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { type TokenInfo, getValidTokenForAdAccount } from '@/lib/facebook/token-helper';
import { decryptToken } from '@/lib/services/metaClient';
import { generateInterestAudience } from '@/ai/flows/generate-interest-audience';

export const dynamic = 'force-dynamic';

/**
 * Collect tokens from authenticated user ONLY (Meta Account Integrity compliance)
 * No longer collects tokens from team members or team owners.
 */
async function collectTokens(session: { user?: { id?: string; email?: string | null } }): Promise<TokenInfo[]> {
  const { getUserTokensOnly } = await import('@/lib/facebook/user-tokens-only');
  return getUserTokensOnly(session as any);
}

async function searchInterestId(interestName: string, accessToken: string): Promise<{ id: string; name: string } | null> {
  try {
    const url = `https://graph.facebook.com/v22.0/search?type=adinterest&q=${encodeURIComponent(interestName)}&limit=1&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.data?.[0]) {
      const item = data.data[0];
      return { id: String(item.id), name: item.name || interestName };
    }
    return null;
  } catch {
    return null;
  }
}

async function validateInterests(interestNames: string[], accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const result: Array<{ id: string; name: string }> = [];
  for (const name of interestNames) {
    const found = await searchInterestId(name, accessToken);
    if (found) result.push(found);
  }
  return result;
}

/** GET: List user's interest audience presets */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let presets: any[] = [];
    try {
      presets = await prisma.interestAudiencePreset.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (dbErr: any) {
      // Model/table may not exist - run: npx prisma generate (stop dev server first) && npx prisma db push
      console.warn('Interest presets fetch skipped:', dbErr?.message);
    }

    return NextResponse.json({ presets: Array.isArray(presets) ? presets : [] });
  } catch (e: any) {
    console.error('Interest audiences GET error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

/** POST: generate (AI) | validate | save | delete */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action = 'generate', description, name, interests, presetId, adAccountId, manualInterests } = body;

    if (action === 'generate') {
      let interestNames: string[] = [];
      let suggestedName: string | undefined;

      if (manualInterests && typeof manualInterests === 'string' && manualInterests.trim().length > 0) {
        // Manual mode: comma-separated interest names (no AI)
        interestNames = manualInterests
          .split(/[,،、;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (description && typeof description === 'string' && description.trim().length >= 5) {
        // AI mode
        try {
          const output = await generateInterestAudience({ description: description.trim() });
          interestNames = output.interests || [];
          suggestedName = output.suggestedName;
        } catch (aiErr: any) {
          const msg = aiErr?.message || '';
          const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests');
          return NextResponse.json(
            {
              error: is429
                ? 'AI quota exceeded. Please add interests manually (comma-separated, e.g. Fashion, Beauty, Shopping)'
                : msg || 'AI failed',
              code: is429 ? 'AI_QUOTA_EXCEEDED' : 'AI_ERROR',
            },
            { status: is429 ? 429 : 500 }
          );
        }
      }

      if (interestNames.length === 0) {
        return NextResponse.json(
          { error: 'description required (min 5 chars) or manualInterests (comma-separated)' },
          { status: 400 }
        );
      }

      // Validate with Meta if adAccountId provided
      let validated: Array<{ id: string; name: string }> = interestNames.map((n) => ({ id: '', name: n }));
      if (adAccountId) {
        const actId = String(adAccountId).startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const tokens = await collectTokens(session);
        const token = await getValidTokenForAdAccount(actId, tokens);
        if (token) {
          validated = await validateInterests(interestNames, token);
        }
      }

      return NextResponse.json({
        interests: interestNames,
        suggestedName,
        validated,
      });
    }

    if (action === 'validate') {
      const names = Array.isArray(body.interestNames) ? body.interestNames : (interests || []).map((i: any) => (typeof i === 'string' ? i : i?.name));
      if (!adAccountId || names.length === 0) {
        return NextResponse.json({ error: 'adAccountId and interestNames required' }, { status: 400 });
      }
      const actId = String(adAccountId).startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const tokens = await collectTokens(session);
      const token = await getValidTokenForAdAccount(actId, tokens);
      if (!token) return NextResponse.json({ error: 'No valid token for this ad account' }, { status: 400 });

      const validated = await validateInterests(names, token);
      return NextResponse.json({ validated });
    }

    if (action === 'save') {
      if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
      const list = Array.isArray(interests) ? interests : [];
      const validInterests = list
        .filter((i: any) => i && (i.id || i.name))
        .map((i: any) => ({ id: String(i.id || ''), name: String(i.name || '') }));

      const preset = await prisma.interestAudiencePreset.create({
        data: {
          userId: session.user.id,
          name: name.trim(),
          description: typeof description === 'string' ? description : null,
          interests: validInterests,
        },
      });
      return NextResponse.json({ preset });
    }

    if (action === 'delete') {
      if (!presetId) return NextResponse.json({ error: 'presetId required' }, { status: 400 });
      await prisma.interestAudiencePreset.deleteMany({
        where: { id: presetId, userId: session.user.id },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    console.error('Interest audiences POST error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
