/**
 * Currency utilities for handling Facebook API currency conversions
 * Facebook API uses "basic units" (cents, satang, etc.) for most currencies
 */

// Currencies without decimal places (no need to divide/multiply by 100)
const ZERO_DECIMAL_CURRENCIES = [
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 
    'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 
    'XOF', 'XPF'
];

/**
 * Check if a currency has decimal places
 */
export function hasDecimalPlaces(currency: string): boolean {
    return !ZERO_DECIMAL_CURRENCIES.includes(currency.toUpperCase());
}

/**
 * Convert from basic units (cents) to main units (dollars)
 * @param amount Amount in basic units from Facebook API
 * @param currency Currency code (e.g., 'USD', 'JPY')
 * @returns Amount in main units
 */
export function fromBasicUnits(amount: number | string | null | undefined, currency: string): number | null {
    if (!amount) return null;
    
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Zero-decimal currencies are already in main units
    if (!hasDecimalPlaces(currency)) {
        return numAmount;
    }
    
    // Most currencies: divide by 100 to convert cents to dollars
    return numAmount / 100;
}

/**
 * Convert from main units (dollars) to basic units (cents)
 * @param amount Amount in main units from user input
 * @param currency Currency code (e.g., 'USD', 'JPY')
 * @returns Amount in basic units for Facebook API
 */
export function toBasicUnits(amount: number | string, currency: string): number {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Zero-decimal currencies are already in basic units
    if (!hasDecimalPlaces(currency)) {
        return Math.round(numAmount);
    }
    
    // Most currencies: multiply by 100 to convert dollars to cents
    return Math.round(numAmount * 100);
}

/** Common currency symbols for display */
const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', THB: '฿', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩',
    SGD: 'S$', MYR: 'RM', PHP: '₱', VND: '₫', IDR: 'Rp', AUD: 'A$',
};

/**
 * Get currency symbol for display (e.g. $, ฿)
 */
export function getCurrencySymbol(currency: string = 'USD'): string {
    const curr = (currency || 'USD').toUpperCase();
    return CURRENCY_SYMBOLS[curr] ?? curr + ' ';
}

/**
 * Format amount with currency symbol according to currency code
 * @param amount Amount to display
 * @param currency Currency code (e.g., 'USD', 'THB', 'JPY')
 * @param locale Optional locale (default: 'en-US')
 * @returns Formatted string e.g. "฿1,234" or "$12.34"
 */
export function formatCurrencyByCode(
    amount: number,
    currency: string = 'USD',
    options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
    const curr = (currency || 'USD').toUpperCase();
    const maxFrac = options?.maximumFractionDigits ?? (hasDecimalPlaces(curr) ? 2 : 0);
    const opts: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: curr,
        maximumFractionDigits: maxFrac,
        minimumFractionDigits: options?.minimumFractionDigits,
    };
    return new Intl.NumberFormat('en-US', opts).format(amount);
}
