import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Create Messenger Ice Breakers (Conversation Starters)
 * These are quick reply buttons that appear when users first open a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pageId, accessToken, productCategory, iceBreakers: providedIceBreakers } = body;

    if (!pageId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing pageId or accessToken' },
        { status: 400 }
      );
    }

    // Use provided ice breakers or defaults based on product category
    const iceBreakers = providedIceBreakers || getIceBreakersForCategory(productCategory);

    console.log('Creating ice breakers for page:', pageId);
    console.log('Ice breakers:', iceBreakers);

    // Check existing ice breakers first to avoid spamming the API (which triggers bans)
    try {
      const existingResponse = await fetch(
        `https://graph.facebook.com/v22.0/${pageId}/messenger_profile?fields=ice_breakers&access_token=${accessToken}`
      );
      const existingData = await existingResponse.json();
      const currentIceBreakers = existingData.data?.[0]?.ice_breakers || [];

      // Simple comparison
      const isSame = JSON.stringify(currentIceBreakers) === JSON.stringify(iceBreakers);

      if (isSame) {
        console.log('✓ Ice breakers already up to date. Skipping update.');
        return NextResponse.json({
          success: true,
          skipped: true,
          iceBreakers,
        });
      }
    } catch (checkError) {
      console.warn('Failed to check existing ice breakers, proceeding with update:', checkError);
    }

    // Set Messenger Profile with Ice Breakers
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${pageId}/messenger_profile`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ice_breakers: iceBreakers,
          access_token: accessToken,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('Failed to create ice breakers:', data);
      return NextResponse.json(
        {
          error: data.error?.message || 'Failed to create ice breakers',
          details: data
        },
        { status: 400 }
      );
    }

    console.log('✓ Ice breakers created successfully');

    return NextResponse.json({
      success: true,
      result: data,
      iceBreakers,
    });
  } catch (error) {
    console.error('Error creating ice breakers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create ice breakers' },
      { status: 500 }
    );
  }
}

/**
 * Get Ice Breakers configuration based on product category
 */
function getIceBreakersForCategory(category?: string) {
  // Category-specific ice breakers
  const categoryBreakers: Record<string, Array<{ question: string; payload: string }>> = {
    'แฟชั่น': [
      { question: '👕 ดูสินค้าใหม่', payload: 'VIEW_NEW_PRODUCTS' },
      { question: '💰 สอบถามราคา', payload: 'ASK_PRICE' },
      { question: '📏 สอบถามไซส์', payload: 'ASK_SIZE' },
      { question: '🚚 สอบถามการจัดส่ง', payload: 'ASK_SHIPPING' },
    ],
    'เครื่องสำอาง': [
      { question: '💄 ดูสินค้าแนะนำ', payload: 'VIEW_RECOMMENDED' },
      { question: '✨ สอบถามผลิตภัณฑ์', payload: 'ASK_PRODUCT' },
      { question: '💰 โปรโมชั่นวันนี้', payload: 'CHECK_PROMOTION' },
      { question: '📦 ตรวจสอบของแถม', payload: 'CHECK_FREEBIES' },
    ],
    'อาหารเสริม': [
      { question: '💊 สอบถามผลิตภัณฑ์', payload: 'ASK_PRODUCT' },
      { question: '🎯 แนะนำสินค้า', payload: 'GET_RECOMMENDATION' },
      { question: '📋 วิธีการใช้', payload: 'HOW_TO_USE' },
      { question: '🚚 สอบถามการจัดส่ง', payload: 'ASK_SHIPPING' },
    ],
    'อิเล็กทรอนิกส์': [
      { question: '📱 ดูสินค้าใหม่', payload: 'VIEW_NEW_PRODUCTS' },
      { question: '💰 เช็คราคา', payload: 'CHECK_PRICE' },
      { question: '🔧 สเปคสินค้า', payload: 'CHECK_SPECS' },
      { question: '🎁 โปรโมชั่นพิเศษ', payload: 'CHECK_PROMOTION' },
    ],
    'ของใช้ในบ้าน': [
      { question: '🏠 ดูสินค้าแนะนำ', payload: 'VIEW_RECOMMENDED' },
      { question: '💰 สอบถามราคา', payload: 'ASK_PRICE' },
      { question: '📦 ตรวจสอบสต็อก', payload: 'CHECK_STOCK' },
      { question: '🚚 จัดส่งฟรีไหม', payload: 'ASK_FREE_SHIPPING' },
    ],
    'อาหาร': [
      { question: '🍽️ ดูเมนูวันนี้', payload: 'VIEW_MENU' },
      { question: '💰 สอบถามราคา', payload: 'ASK_PRICE' },
      { question: '🚚 สั่งเดลิเวอรี่', payload: 'ORDER_DELIVERY' },
      { question: '⏰ เวลาทำการ', payload: 'CHECK_HOURS' },
    ],
    'เครื่องดื่ม': [
      { question: '☕ ดูเมนูเครื่องดื่ม', payload: 'VIEW_DRINKS_MENU' },
      { question: '🎁 โปรโมชั่นวันนี้', payload: 'CHECK_PROMOTION' },
      { question: '💰 สอบถามราคา', payload: 'ASK_PRICE' },
      { question: '📍 สาขาใกล้ฉัน', payload: 'FIND_LOCATION' },
    ],
    'บริการ': [
      { question: '📋 ดูบริการทั้งหมด', payload: 'VIEW_SERVICES' },
      { question: '💰 สอบถามค่าบริการ', payload: 'ASK_PRICE' },
      { question: '📅 นัดหมาย', payload: 'MAKE_APPOINTMENT' },
      { question: '📞 ติดต่อเรา', payload: 'CONTACT_US' },
    ],
  };

  // Try to match category
  const matchedCategory = Object.keys(categoryBreakers).find(cat =>
    category?.toLowerCase().includes(cat.toLowerCase())
  );

  if (matchedCategory) {
    return categoryBreakers[matchedCategory];
  }

  // Default general ice breakers
  return [
    { question: '✨ สนใจสินค้าอะไร?', payload: 'INTERESTED_PRODUCT' },
    { question: '💰 สอบถามราคา', payload: 'ASK_PRICE' },
    { question: '🎁 โปรโมชั่นวันนี้', payload: 'CHECK_PROMOTION' },
    { question: '🚚 สอบถามการจัดส่ง', payload: 'ASK_SHIPPING' },
  ];
}

/**
 * Delete Ice Breakers
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pageId, accessToken } = body;

    if (!pageId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing pageId or accessToken' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${pageId}/messenger_profile?fields=ice_breakers&access_token=${accessToken}`,
      {
        method: 'DELETE',
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('Failed to delete ice breakers:', data);
      return NextResponse.json(
        { error: data.error?.message || 'Failed to delete ice breakers' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      result: data,
    });
  } catch (error) {
    console.error('Error deleting ice breakers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete ice breakers' },
      { status: 500 }
    );
  }
}

/**
 * Get current Ice Breakers
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const accessToken = searchParams.get('accessToken');

    if (!pageId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing pageId or accessToken' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${pageId}/messenger_profile?fields=ice_breakers&access_token=${accessToken}`
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('Failed to get ice breakers:', data);
      return NextResponse.json(
        { error: data.error?.message || 'Failed to get ice breakers' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.data?.[0]?.ice_breakers || [],
    });
  } catch (error) {
    console.error('Error getting ice breakers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get ice breakers' },
      { status: 500 }
    );
  }
}
