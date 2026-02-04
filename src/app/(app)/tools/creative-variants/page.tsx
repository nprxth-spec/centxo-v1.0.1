'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Copy, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Variant = { primaryText: string; headline: string };

export default function CreativeVariantsPage() {
  const { t } = useLanguage();
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [productContext, setProductContext] = useState('');
  const [count, setCount] = useState<number>(4);
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const hasInput = primaryText.trim() || headline.trim() || productContext.trim();

  const handleGenerate = async () => {
    if (!hasInput) {
      toast.error(t('tools.creativeVariants.error', 'Enter at least one field'));
      return;
    }
    setLoading(true);
    setVariants([]);
    try {
      const res = await fetch('/api/ai/generate-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryText: primaryText.trim() || undefined,
          headline: headline.trim() || undefined,
          productContext: productContext.trim() || undefined,
          count,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate');
      }
      setVariants(data.variants || []);
      const n = (data.variants || []).length;
      toast.success(
        `${t('tools.creativeVariants.generated', 'Generated')} ${n} ${t('tools.creativeVariants.variantsWord', 'variants')}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate variants';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setPrimaryText('');
    setHeadline('');
    setProductContext('');
    setCount(4);
    setVariants([]);
    setCopiedIndex(null);
    toast.success(t('tools.creativeVariants.cleared', 'Form and results cleared'));
  };

  const copyVariant = (v: Variant, i: number) => {
    const text = `${v.primaryText}\n---\n${v.headline}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(i);
      toast.success(t('tools.creativeVariants.copied', 'Copied to clipboard'));
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-[900px] mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-outfit font-bold text-foreground tracking-tight flex items-center gap-2">
          <span className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
            <Sparkles className="h-6 w-6" />
          </span>
          {t('tools.creativeVariants.title', 'A/B Creative Lab')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('tools.creativeVariants.subtitle', 'Generate multiple ad copy variants for A/B testing')}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="primary">{t('tools.creativeVariants.primaryText', 'Primary text')}</Label>
          <Textarea
            id="primary"
            placeholder={t('tools.creativeVariants.placeholderPrimary', 'Paste or type your ad primary text...')}
            value={primaryText}
            onChange={(e) => setPrimaryText(e.target.value)}
            className="min-h-[100px] resize-y"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="headline">{t('tools.creativeVariants.headline', 'Headline')}</Label>
          <Input
            id="headline"
            placeholder={t('tools.creativeVariants.placeholderHeadline', 'Short headline (optional)')}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="context">{t('tools.creativeVariants.productContext', 'Product / context')}</Label>
          <Input
            id="context"
            placeholder={t('tools.creativeVariants.placeholderContext', 'e.g. Organic dog food, skincare')}
            value={productContext}
            onChange={(e) => setProductContext(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2 w-[140px]">
            <Label>{t('tools.creativeVariants.variantCount', 'Variants')}</Label>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!hasInput || loading}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {t('tools.creativeVariants.generate', 'Generate variants')}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {t('tools.creativeVariants.clear', 'Clear')}
          </Button>
        </div>
      </div>

      {variants.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {t('tools.creativeVariants.results', 'Results')} ({variants.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {variants.map((v, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl border bg-card p-4 transition-all hover:border-violet-500/30',
                  'flex flex-col gap-3'
                )}
              >
                <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                  {t('tools.creativeVariants.variant', 'Variant')} {i + 1}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{v.primaryText}</p>
                <p className="text-xs text-muted-foreground font-medium">{v.headline}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => copyVariant(v, i)}
                >
                  {copiedIndex === i ? (
                    <Check className="h-4 w-4 mr-1 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {t('tools.creativeVariants.copy', 'Copy')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && variants.length === 0 && hasInput && (
        <p className="text-center text-muted-foreground text-sm">
          {t('tools.creativeVariants.hint', 'Click "Generate variants" to create A/B test copies.')}
        </p>
      )}
    </div>
  );
}
