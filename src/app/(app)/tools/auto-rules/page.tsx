'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Loader2,
  Plus,
  Trash2,
  Play,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdAccount } from '@/contexts/AdAccountContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  scope: string;
  adAccountIds: string;
  condition: { metric: string; op: string; value: number };
  action: { type: string };
  lastRunAt: string | null;
  lastResult: string | null;
  createdAt: string;
};

const METRICS = [
  { value: 'spend', label: 'Spend' },
  { value: 'messages', label: 'Messages' },
  { value: 'impressions', label: 'Impressions' },
  { value: 'reach', label: 'Reach' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'costPerMessage', label: 'Cost per message' },
];
const OPS = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'eq', label: '=' },
];

export default function AutoRulesPage() {
  const { t } = useLanguage();
  const { selectedAccounts } = useAdAccount();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [setupRequired, setSetupRequired] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    metric: 'spend',
    op: 'gt',
    value: '10',
  });

  const fetchRules = useCallback(async () => {
    setSetupRequired(null);
    try {
      const res = await fetch('/api/automation/rules');
      const data = await res.json();
      if (res.ok) {
        setRules(data.rules || []);
      } else {
        setRules([]);
        const details = data.details ?? '';
        if (res.status === 503 && /migrate|prisma|generate/i.test(details)) {
          setSetupRequired(details || data.error || 'Setup required');
        } else {
          toast.error(data.error || 'Failed to load rules');
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const createRule = async () => {
    if (!form.name.trim()) {
      toast.error(t('tools.autoRules.nameRequired', 'Name is required'));
      return;
    }
    const value = parseFloat(form.value);
    if (!Number.isFinite(value)) {
      toast.error(t('tools.autoRules.invalidValue', 'Invalid value'));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          enabled: true,
          scope: 'campaign',
          condition: { metric: form.metric, op: form.op, value },
          action: { type: 'pause' },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to create');
        throw new Error(err);
      }
      setRules((prev) => [data, ...prev]);
      setForm({ name: '', metric: 'spend', op: 'gt', value: '10' });
      setShowForm(false);
      toast.success(t('tools.autoRules.created', 'Rule created'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create rule');
    } finally {
      setCreating(false);
    }
  };

  const toggleEnabled = async (r: Rule) => {
    try {
      const res = await fetch(`/api/automation/rules/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !r.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to update'));
      setRules((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x))
      );
      toast.success(r.enabled ? t('tools.autoRules.disabled', 'Rule disabled') : t('tools.autoRules.enabled', 'Rule enabled'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const deleteRule = async (r: Rule) => {
    if (!confirm(t('tools.autoRules.deleteConfirm', 'Delete this rule?'))) return;
    try {
      const res = await fetch(`/api/automation/rules/${r.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to delete'));
      setRules((prev) => prev.filter((x) => x.id !== r.id));
      toast.success(t('tools.autoRules.deleted', 'Rule deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const runNow = async () => {
    const ids = selectedAccounts.map((a) => a.id);
    if (ids.length === 0) {
      toast.error(t('tools.autoRules.selectAccounts', 'Select ad accounts in Settings → Connections'));
      return;
    }
    setRunning(true);
    try {
      const res = await fetch('/api/automation/rules/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || 'Run failed');
      const n = data.paused?.length ?? 0;
      const errs = Array.isArray(data.errors) ? data.errors : [];
      if (n > 0) {
        toast.success(
          `${t('tools.autoRules.runComplete', 'Run complete')}. ${n} ${t('tools.autoRules.campaignsPaused', 'campaign(s) paused')}.`
        );
      } else if (errs.length > 0) {
        const msg = errs[0]?.startsWith('No enabled') ? errs[0] : errs.join('; ');
        toast.info(msg);
      } else {
        toast.success(t('tools.autoRules.runDone', 'Run complete. No campaigns paused.'));
      }
      fetchRules();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const opLabel = (op: string) => OPS.find((o) => o.value === op)?.label ?? op;
  const metricLabel = (m: string) => METRICS.find((x) => x.value === m)?.label ?? m;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-[900px] mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-outfit font-bold text-foreground tracking-tight flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Zap className="h-6 w-6" />
            </span>
            {t('tools.autoRules.title', 'Auto Rules')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('tools.autoRules.subtitle', 'Automatically pause campaigns when conditions are met')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={runNow}
            disabled={!!setupRequired || running || rules.length === 0 || (mounted && selectedAccounts.length === 0)}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {t('tools.autoRules.runNow', 'Run now')}
          </Button>
          <Button
            onClick={() => setShowForm((v) => !v)}
            disabled={!!setupRequired}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {showForm ? <ChevronUp className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showForm ? t('common.cancel', 'Cancel') : t('tools.autoRules.addRule', 'Add rule')}
          </Button>
        </div>
      </div>

      {setupRequired && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
          <AlertDescription>
            <span className="font-medium">{t('tools.autoRules.setupRequired', 'Setup required')}</span>
            <br />
            <code className="mt-2 block rounded bg-black/20 px-2 py-1 text-sm">{setupRequired}</code>
          </AlertDescription>
        </Alert>
      )}

      {mounted && selectedAccounts.length === 0 && !setupRequired && (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          {t('tools.autoRules.selectAccounts', 'Select ad accounts in Settings → Connections')} to run rules.
        </p>
      )}

      {showForm && (
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold">{t('tools.autoRules.newRule', 'New rule')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('tools.autoRules.name', 'Name')}</Label>
              <Input
                placeholder={t('tools.autoRules.namePlaceholder', 'e.g. Pause low ROAS')}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('tools.autoRules.value', 'Value')}</Label>
              <Input
                type="number"
                step="any"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>{t('tools.autoRules.metric', 'Metric')}</Label>
              <Select value={form.metric} onValueChange={(v) => setForm((f) => ({ ...f, metric: v }))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('tools.autoRules.operator', 'Operator')}</Label>
              <Select value={form.op} onValueChange={(v) => setForm((f) => ({ ...f, op: v }))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('tools.autoRules.ruleHint', 'When condition is true, matching campaigns will be paused.')}
          </p>
          <Button
            onClick={createRule}
            disabled={creating}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {t('tools.autoRules.create', 'Create rule')}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-semibold">{t('tools.autoRules.rules', 'Rules')}</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            {setupRequired
              ? t('tools.autoRules.completeSetupFirst', 'Complete setup above first, then add a rule.')
              : t('tools.autoRules.noRules', 'No rules yet. Add a rule to get started.')}
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((r) => (
              <div
                key={r.id}
                className={cn(
                  'rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4',
                  !r.enabled && 'opacity-60'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {metricLabel(r.condition?.metric)} {opLabel(r.condition?.op)} {r.condition?.value}
                    </span>
                    <span className="text-xs text-amber-600">→ {t('tools.autoRules.pause', 'Pause')}</span>
                  </div>
                  {r.lastRunAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('tools.autoRules.lastRun', 'Last run')}: {new Date(r.lastRunAt).toLocaleString()}
                      {r.lastResult && ` — ${r.lastResult}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={r.enabled} onCheckedChange={() => toggleEnabled(r)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteRule(r)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
