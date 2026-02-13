'use client';

import { Check, X, Sparkles, Zap, Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  type Plan,
  type Currency,
  type BillingCycle,
  formatPrice,
  getYearlyDiscountPercent,
} from '@/lib/plans';

// ============================================================================
// TYPES
// ============================================================================

export interface PricingCardProps {
  plan: Plan;
  currency?: Currency;
  billingCycle?: BillingCycle;
  currentPlan?: string;
  onSelect?: (planId: string) => void;
  loading?: boolean;
  showTrialInfo?: boolean;
  trialDaysLeft?: number;
  className?: string;
  compact?: boolean;
}

// ============================================================================
// ICON MAPPING
// ============================================================================

const PlanIcons = {
  Sparkles,
  Zap,
  Crown,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PricingCard({
  plan,
  currency = 'USD',
  billingCycle = 'monthly',
  currentPlan,
  onSelect,
  loading = false,
  showTrialInfo = false,
  trialDaysLeft,
  className,
  compact = false,
}: PricingCardProps) {
  const { t, language } = useLanguage();
  const Icon = PlanIcons[plan.icon];

  const isCurrent = currentPlan?.toUpperCase() === plan.id;
  const pricing = plan.pricing[currency];
  const price = billingCycle === 'monthly' ? pricing.monthly : pricing.yearly;
  const originalPrice = billingCycle === 'monthly' ? pricing.originalMonthly : pricing.originalYearly;
  const yearlyDiscount = getYearlyDiscountPercent(plan.id, currency);

  // Get localized plan name
  const planName = t(plan.nameKey, plan.name);
  const planDescription = t(plan.descriptionKey, plan.description);

  // Determine button state
  const isFreePlan = plan.id === 'FREE';
  const canUpgrade = !isCurrent && !isFreePlan;
  const isPaidPlan = !isFreePlan && isCurrent;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border bg-card transition-all duration-200',
        plan.recommended
          ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary'
          : 'border-border hover:border-primary/50',
        isCurrent && 'ring-2 ring-primary border-primary',
        className
      )}
    >
      {/* Recommended Badge */}
      {plan.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-medium shadow-sm">
            {t('settings.billing.popular', 'Most Popular')}
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className={cn('p-6', plan.recommended && 'pt-8')}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              'p-2 rounded-lg',
              plan.id === 'FREE' && 'bg-slate-100 text-slate-600',
              plan.id === 'PLUS' && 'bg-blue-100 text-blue-600',
              plan.id === 'PRO' && 'bg-purple-100 text-purple-600'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{planName}</h3>
            {!compact && (
              <p className="text-sm text-muted-foreground">{planDescription}</p>
            )}
          </div>
        </div>

        {/* Trial Info */}
        {showTrialInfo && isCurrent && plan.id === 'FREE' && trialDaysLeft !== undefined && (
          <div
            className={cn(
              'mb-4 text-xs font-medium px-2 py-1 rounded inline-block',
              trialDaysLeft > 0
                ? 'text-amber-600 bg-amber-50'
                : 'text-red-600 bg-red-50'
            )}
          >
            {trialDaysLeft > 0
              ? t('settings.billing.trialDaysLeft', '{days} days left in trial').replace('{days}', String(trialDaysLeft))
              : t('settings.billing.trialExpired', 'Trial Expired')}
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-4">
          <span className="text-3xl font-bold text-foreground">
            {formatPrice(price, currency)}
          </span>
          {originalPrice && originalPrice > price && (
            <span className="text-lg text-muted-foreground line-through">
              {formatPrice(originalPrice, currency)}
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            {billingCycle === 'monthly'
              ? t('settings.billing.period', '/month')
              : t('settings.billing.periodYear', '/year')}
          </span>
        </div>

        {/* Yearly Savings Badge */}
        {billingCycle === 'yearly' && yearlyDiscount > 0 && (
          <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700 border-0">
            {t('settings.billing.savePercent', 'Save {percent}%').replace('{percent}', String(yearlyDiscount))}
          </Badge>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border mx-6" />

      {/* Features */}
      <div className="p-6 flex-1">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-lg font-bold text-foreground">{plan.limits.adAccounts}</div>
            <div className="text-xs text-muted-foreground">
              {language === 'th' ? 'แอด' : 'Ads'}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-lg font-bold text-foreground">{plan.limits.pages}</div>
            <div className="text-xs text-muted-foreground">
              {language === 'th' ? 'เพจ' : 'Pages'}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <div className="text-lg font-bold text-foreground">{plan.limits.teamMembers}</div>
            <div className="text-xs text-muted-foreground">
              {language === 'th' ? 'ทีม' : 'Team'}
            </div>
          </div>
        </div>

        {/* Feature List */}
        {!compact && (
          <ul className="space-y-2">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                {feature.included ? (
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    feature.included ? 'text-foreground' : 'text-muted-foreground/50'
                  )}
                >
                  {t(feature.key, feature.fallback)}
                  {feature.badge && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-2 text-[10px] px-1.5 py-0',
                        feature.badge === 'NEW' && 'border-green-500 text-green-500',
                        feature.badge === 'AI' && 'border-purple-500 text-purple-500',
                        feature.badge === 'BETA' && 'border-amber-500 text-amber-500'
                      )}
                    >
                      {feature.badge}
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action Button */}
      <div className="p-6 pt-0">
        {isCurrent && isPaidPlan ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onSelect?.(plan.id)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('settings.billing.manage', 'Manage Subscription')
            )}
          </Button>
        ) : (
          <Button
            variant={isCurrent ? 'outline' : plan.recommended ? 'default' : 'outline'}
            className={cn(
              'w-full',
              isCurrent && 'cursor-default',
              plan.recommended && !isCurrent && 'bg-primary hover:bg-primary/90'
            )}
            onClick={() => !isCurrent && onSelect?.(plan.id)}
            disabled={isCurrent || loading || isFreePlan}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCurrent ? (
              t('settings.billing.currentPlan', 'Current Plan')
            ) : isFreePlan ? (
              t('settings.billing.currentPlan', 'Current Plan')
            ) : (
              t('settings.billing.upgrade', 'Upgrade')
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PRICING GRID COMPONENT
// ============================================================================

export interface PricingGridProps {
  plans: Plan[];
  currency?: Currency;
  billingCycle?: BillingCycle;
  currentPlan?: string;
  onSelectPlan?: (planId: string) => void;
  loadingPlan?: string | null;
  showTrialInfo?: boolean;
  trialDaysLeft?: number;
  className?: string;
}

export function PricingGrid({
  plans,
  currency = 'USD',
  billingCycle = 'monthly',
  currentPlan,
  onSelectPlan,
  loadingPlan,
  showTrialInfo = false,
  trialDaysLeft,
  className,
}: PricingGridProps) {
  return (
    <div className={cn('grid gap-6', className)}>
      {plans.map((plan) => (
        <PricingCard
          key={plan.id}
          plan={plan}
          currency={currency}
          billingCycle={billingCycle}
          currentPlan={currentPlan}
          onSelect={onSelectPlan}
          loading={loadingPlan === plan.id}
          showTrialInfo={showTrialInfo}
          trialDaysLeft={trialDaysLeft}
        />
      ))}
    </div>
  );
}

// ============================================================================
// BILLING CYCLE TOGGLE
// ============================================================================

export interface BillingCycleToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  yearlyDiscount?: number;
  className?: string;
}

export function BillingCycleToggle({
  value,
  onChange,
  yearlyDiscount = 17,
  className,
}: BillingCycleToggleProps) {
  const { t } = useLanguage();

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      <button
        onClick={() => onChange('monthly')}
        className={cn(
          'px-4 py-2 rounded-lg text-sm font-medium transition-all',
          value === 'monthly'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {t('settings.billing.monthly', 'Monthly')}
      </button>
      <button
        onClick={() => onChange('yearly')}
        className={cn(
          'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
          value === 'yearly'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {t('settings.billing.yearly', 'Yearly')}
        {yearlyDiscount > 0 && (
          <Badge className="bg-green-500 text-white text-[10px] px-1.5">
            -{yearlyDiscount}%
          </Badge>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// CURRENCY SELECTOR
// ============================================================================

export interface CurrencySelectorProps {
  value: Currency;
  onChange: (currency: Currency) => void;
  className?: string;
}

export function CurrencySelector({
  value,
  onChange,
  className,
}: CurrencySelectorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={() => onChange('USD')}
        className={cn(
          'px-3 py-1.5 rounded-md text-sm font-medium transition-all border',
          value === 'USD'
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        )}
      >
        $ USD
      </button>
      <button
        onClick={() => onChange('THB')}
        className={cn(
          'px-3 py-1.5 rounded-md text-sm font-medium transition-all border',
          value === 'THB'
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        )}
      >
        ฿ THB
      </button>
    </div>
  );
}
