export type IceBreakerItem = { question: string; payload: string };

export const RECOMMENDED_ICE_BREAKER_TEMPLATES: { name: string; items: IceBreakerItem[] }[] = [
  {
    name: 'แฟชั่น',
    items: [
      { question: '👕 ดูสินค้าใหม่', payload: 'VIEW_NEW_PRODUCTS' },
      { question: '💰 สอบถามราคา', payload: 'ASK_PRICE' },
      { question: '📏 สอบถามไซส์', payload: 'ASK_SIZE' },
      { question: '🚚 สอบถามการจัดส่ง', payload: 'ASK_SHIPPING' },
    ],
  },
  {
    name: 'ความงาม / เครื่องสำอาง',
    items: [
      { question: '💄 ดูสินค้าแนะนำ', payload: 'VIEW_RECOMMENDED' },
      { question: '✨ สอบถามผลิตภัณฑ์', payload: 'ASK_PRODUCT' },
      { question: '💰 โปรโมชั่นวันนี้', payload: 'CHECK_PROMOTION' },
      { question: '📦 ตรวจสอบของแถม', payload: 'CHECK_FREEBIES' },
    ],
  },
  {
    name: 'อาหาร / เครื่องดื่ม',
    items: [
      { question: '🍽️ ดูเมนูวันนี้', payload: 'VIEW_MENU' },
      { question: '💰 สอบถามราคา', payload: 'ASK_PRICE' },
      { question: '🚚 สั่งเดลิเวอรี่', payload: 'ORDER_DELIVERY' },
      { question: '⏰ เวลาทำการ', payload: 'CHECK_HOURS' },
    ],
  },
  {
    name: 'อิเล็กทรอนิกส์',
    items: [
      { question: '📱 ดูสินค้าใหม่', payload: 'VIEW_NEW_PRODUCTS' },
      { question: '💰 เช็คราคา', payload: 'CHECK_PRICE' },
      { question: '🔧 สเปคสินค้า', payload: 'CHECK_SPECS' },
      { question: '🎁 โปรโมชั่นพิเศษ', payload: 'CHECK_PROMOTION' },
    ],
  },
  {
    name: 'ทั่วไป',
    items: [
      { question: '✨ สนใจสินค้าอะไร?', payload: 'INTERESTED_PRODUCT' },
      { question: '💰 สอบถามราคา', payload: 'ASK_PRICE' },
      { question: '🎁 โปรโมชั่นวันนี้', payload: 'CHECK_PROMOTION' },
      { question: '🚚 สอบถามการจัดส่ง', payload: 'ASK_SHIPPING' },
    ],
  },
];
