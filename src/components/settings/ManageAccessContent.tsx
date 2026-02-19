
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Loader2, RefreshCw } from 'lucide-react';
import { useConfig } from '@/contexts/AdAccountContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ManageAccessContentProps {
    subscription: any;
    initialTab?: string;
    onSaved?: () => void;
    onClose?: () => void;
    onUpgrade?: () => void;
}

export function ManageAccessContent({
    subscription,
    onSaved,
    onClose,
    onUpgrade,
    initialTab = 'pages',
}: ManageAccessContentProps) {
    const { t } = useLanguage();
    const { refreshData } = useConfig();

    // Use local state only - don't sync with URL to avoid conflicts with parent tabs
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pages, setPages] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [adAccounts, setAdAccounts] = useState<any[]>([]);
    const [searchPages, setSearchPages] = useState('');
    const [searchUsers, setSearchUsers] = useState('');
    const [searchAdAccounts, setSearchAdAccounts] = useState('');
    const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedAdAccountIds, setSelectedAdAccountIds] = useState<string[]>([]);
    const [pagesHint, setPagesHint] = useState<'no_team_members' | 'fetch_failed' | null>(null);
    const [pagesError, setPagesError] = useState<string | null>(null);
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
    const [autoRenew, setAutoRenew] = useState(false);
    const [packageName, setPackageName] = useState('');

    const packageId = subscription?.id || '';
    const maxPages = subscription?.maxPages || 0;
    const maxUsers = subscription?.maxUsers || 0;
    const maxAdAccounts = subscription?.maxAdAccounts ?? 0;

    useEffect(() => {
        if (subscription) {
            setSelectedPageIds(subscription.selectedPageIds || []);
            setSelectedUserIds(subscription.selectedUserIds || []);
            setSelectedAdAccountIds(subscription.selectedAdAccountIds || []);
            setAutoRenew(subscription.autoRenew || false);
            setPackageName(subscription.name || '');
        }
    }, [subscription?.id, JSON.stringify(subscription?.selectedPageIds ?? []), JSON.stringify(subscription?.selectedUserIds ?? []), JSON.stringify(subscription?.selectedAdAccountIds ?? [])]);

    // Simple tab change handler - no URL sync to avoid conflicts with parent Settings tabs
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
    };

    // Only load data when packageId changes - avoids refetch on every parent re-render
    useEffect(() => {
        if (packageId) {
            setLoading(true);
            setPagesError(null);
            setPagesHint(null);
            const loadData = (forceRefresh = false) => {
                const pagesUrl = forceRefresh ? '/api/team/pages?refresh=true&mode=business' : '/api/team/pages?mode=business';
                const adAccountsUrl = forceRefresh ? '/api/team/ad-accounts?refresh=true&mode=business' : '/api/team/ad-accounts?mode=business';
                Promise.all([
                    fetch(pagesUrl).then(async (r) => ({ ok: r.ok, data: await r.json() })),
                    fetch('/api/team/members').then((r) => r.json()),
                    fetch(adAccountsUrl).then((r) => r.json()),
                ])
                    .then(([pagesRes, membersRes, adAccountsRes]) => {
                        const pagesData = pagesRes.data;
                        const pagesList = pagesData?.pages || [];
                        setPages(pagesList);
                        if (!pagesRes.ok && pagesData?.error) setPagesError(pagesData.error);
                        else if (pagesData?.hint) setPagesHint(pagesData.hint);

                        const teamMembersList = membersRes.members || [];
                        const host = membersRes.host;
                        if (host && !teamMembersList.some((m: any) => m.id === host.id || m.facebookUserId === host.id || m.memberEmail === host.email)) {
                            teamMembersList.unshift({
                                id: host.id,
                                memberType: 'email',
                                facebookUserId: null,
                                facebookName: null,
                                facebookEmail: null,
                                memberEmail: host.email,
                                memberName: host.name,
                                memberImage: host.image,
                                role: host.role || 'OWNER',
                                addedAt: null,
                                lastUsedAt: null,
                            });
                        }
                        setMembers(teamMembersList);
                        setAdAccounts(adAccountsRes.accounts || []);

                        if (!forceRefresh && pagesList.length === 0 && (pagesData?.hint === 'no_team_members' || pagesData?.hint === 'fetch_failed')) {
                            loadData(true);
                        } else {
                            setLoading(false);
                        }
                    })
                    .catch((err) => {
                        console.error(err);
                        setPagesError(t('subDialog.loadError'));
                        setLoading(false);
                    });
            };
            loadData(false);
        }
    }, [packageId, t]);

    const filteredPages = pages.filter(
        (p) =>
            !searchPages ||
            p.name?.toLowerCase().includes(searchPages.toLowerCase()) ||
            p.id?.includes(searchPages)
    );
    // Users tab: show only team members (email/Google invite), not Facebook-connected accounts
    const teamOnlyMembers = members.filter((m) => m.memberType === 'email');
    const filteredMembers = members.filter(
        (m) =>
            !searchUsers ||
            m.facebookName?.toLowerCase().includes(searchUsers.toLowerCase()) ||
            m.memberName?.toLowerCase().includes(searchUsers.toLowerCase()) ||
            m.memberEmail?.toLowerCase().includes(searchUsers.toLowerCase()) ||
            m.facebookUserId?.includes(searchUsers)
    );
    const filteredTeamMembers = teamOnlyMembers.filter(
        (m) =>
            !searchUsers ||
            m.memberName?.toLowerCase().includes(searchUsers.toLowerCase()) ||
            m.memberEmail?.toLowerCase().includes(searchUsers.toLowerCase())
    );
    const filteredAdAccounts = adAccounts.filter(
        (a) =>
            !searchAdAccounts ||
            a.name?.toLowerCase().includes(searchAdAccounts.toLowerCase()) ||
            a.id?.toLowerCase().includes(searchAdAccounts.toLowerCase()) ||
            a.account_id?.includes(searchAdAccounts)
    );

    const togglePage = (pageId: string) => {
        setSelectedPageIds((prev) => {
            if (prev.includes(pageId)) return prev.filter((id) => id !== pageId);
            if (prev.length >= maxPages) {
                setShowUpgradeDialog(true);
                return prev;
            }
            return [...prev, pageId];
        });
    };

    const toggleUser = (userId: string) => {
        setSelectedUserIds((prev) => {
            if (prev.includes(userId)) return prev.filter((id) => id !== userId);
            if (prev.length >= maxUsers) {
                setShowUpgradeDialog(true);
                return prev;
            }
            return [...prev, userId];
        });
    };

    const toggleAdAccount = (accountId: string) => {
        setSelectedAdAccountIds((prev) => {
            if (prev.includes(accountId)) return prev.filter((id) => id !== accountId);
            if (prev.length >= maxAdAccounts) {
                setShowUpgradeDialog(true);
                return prev;
            }
            return [...prev, accountId];
        });
    };

    const isTrial = packageId === 'TRIAL';

    const handleSave = async () => {
        if (!packageId || isTrial) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/subscriptions/${packageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedPageIds,
                    selectedUserIds,
                    selectedAdAccountIds,
                    autoRenew,
                    name: packageName,
                }),
            });
            if (res.ok) {
                onSaved?.();
                await refreshData(true, { bypassCooldown: true });
            } else {
                const data = await res.json();
                alert(data.error || t('subDialog.saveFailed'));
            }
        } catch (e) {
            console.error(e);
            alert(t('subDialog.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="pages">
                        {t('subDialog.tabPages', 'Pages')} ({selectedPageIds.length}/{maxPages})
                    </TabsTrigger>
                    <TabsTrigger value="ad-accounts">
                        {t('subDialog.tabAdAccounts', 'Ad Accounts')} ({selectedAdAccountIds.length}/{maxAdAccounts})
                    </TabsTrigger>
                    <TabsTrigger value="users">
                        {t('subDialog.tabUsers', 'Users')} ({selectedUserIds.length}/{maxUsers})
                    </TabsTrigger>
                </TabsList>

                <div className="flex-1 flex flex-col min-h-0">
                    <TabsContent value="pages" className="mt-0 flex-1 flex flex-col min-h-0">
                        <div className="flex items-center gap-2 shrink-0 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('subDialog.search')}
                                    value={searchPages}
                                    onChange={(e) => setSearchPages(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Button variant="outline" size="icon" title={t('subDialog.refresh', 'Refresh')} disabled={loading}
                                onClick={() => {
                                    setLoading(true);
                                    setPagesError(null);
                                    setPagesHint(null);
                                    fetch('/api/team/pages?refresh=true&mode=business').then(async (r) => ({ ok: r.ok, data: await r.json() }))
                                        .then((res) => { setPages(res.data?.pages || []); if (res.data?.hint) setPagesHint(res.data.hint); })
                                        .catch(() => setPagesError(t('subDialog.loadError')))
                                        .finally(() => setLoading(false));
                                }}>
                                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                            </Button>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-8 flex-1">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="flex-1 min-h-0 overflow-y-auto border border-border rounded-lg">
                                <table className="w-full text-sm table-fixed">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/50">
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground w-12"></th>
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[30%]">{t('subDialog.name')}</th>
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[30%]">{t('subDialog.labelId')}</th>
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[30%]">{t('subDialog.owner')}</th>
                                            <th className="text-center py-3 px-3 font-medium text-muted-foreground w-16">{t('subDialog.select')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPages.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                                                    {pagesError ? pagesError : t('subDialog.noData')}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPages.map((page, i) => (
                                                <tr
                                                    key={page.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => togglePage(page.id)}
                                                    className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer select-none ${i % 2 === 1 ? 'bg-muted/20' : ''}`}
                                                >
                                                    <td className="py-2 px-3">
                                                        <Avatar className="w-9 h-9">
                                                            <AvatarImage src={page.picture?.data?.url} />
                                                            <AvatarFallback className="text-xs">{page.name?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                    </td>
                                                    <td className="py-2 px-3 font-medium truncate">{page.name}</td>
                                                    <td className="py-2 px-3 text-muted-foreground truncate">{page.id}</td>
                                                    <td className="py-2 px-3 text-muted-foreground truncate">{page._source?.facebookName || '-'}</td>
                                                    <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={selectedPageIds.includes(page.id)}
                                                            onCheckedChange={() => togglePage(page.id)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="ad-accounts" className="mt-0 flex-1 flex flex-col min-h-0 py-4">
                        <div className="flex items-center gap-2 shrink-0 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('subDialog.search')}
                                    value={searchAdAccounts}
                                    onChange={(e) => setSearchAdAccounts(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Button variant="outline" size="icon" title={t('subDialog.refresh', 'Refresh')} disabled={loading}
                                onClick={() => {
                                    setLoading(true);
                                    fetch('/api/team/ad-accounts?refresh=true&mode=business')
                                        .then(r => r.json())
                                        .then((res) => { setAdAccounts(res.accounts || []); })
                                        .catch((err) => console.error('Refresh Ad Accounts failed:', err))
                                        .finally(() => setLoading(false));
                                }}>
                                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                            </Button>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-8 flex-1">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="flex-1 min-h-0 overflow-y-auto border border-border rounded-lg">
                                <table className="w-full text-sm table-fixed">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/50">
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground w-12"></th>
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[30%]">{t('subDialog.name')}</th>
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[30%]">{t('subDialog.labelId')}</th>
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground w-[30%]">{t('subDialog.owner')}</th>
                                            <th className="text-center py-3 px-3 font-medium text-muted-foreground w-16">{t('subDialog.select')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAdAccounts.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                                                    {t('subDialog.noData')}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredAdAccounts.map((account, i) => (
                                                <tr
                                                    key={account.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => toggleAdAccount(account.id)}
                                                    className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer select-none ${i % 2 === 1 ? 'bg-muted/20' : ''}`}
                                                >
                                                    <td className="py-2 px-3">
                                                        <Avatar className="w-9 h-9">
                                                            <AvatarImage src={account.business_profile_picture_uri} />
                                                            <AvatarFallback className="text-xs">{account.name?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                    </td>
                                                    <td className="py-2 px-3 font-medium truncate">{account.name}</td>
                                                    <td className="py-2 px-3 text-muted-foreground truncate">{account.id?.replace('act_', '')}</td>
                                                    <td className="py-2 px-3 text-muted-foreground truncate">{account._source?.facebookName || '-'}</td>
                                                    <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={selectedAdAccountIds.includes(account.id)}
                                                            onCheckedChange={() => toggleAdAccount(account.id)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="users" className="mt-0 flex-1 flex flex-col min-h-0 py-4">
                        <div className="flex items-center gap-2 shrink-0 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('subDialog.search')}
                                    value={searchUsers}
                                    onChange={(e) => setSearchUsers(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-8 flex-1">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="flex-1 min-h-0 overflow-y-auto border border-border rounded-lg">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/50">
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground w-12"></th>
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground">{t('subDialog.name')}</th>
                                            <th className="text-left py-3 px-3 font-medium text-muted-foreground">{t('subDialog.idOrEmail')}</th>
                                            <th className="text-center py-3 px-3 font-medium text-muted-foreground w-16">{t('subDialog.select')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTeamMembers.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
                                                    {t('subDialog.noData')}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTeamMembers.map((member, i) => {
                                                const memberId = member.id || member.facebookUserId || '';
                                                return (
                                                    <tr
                                                        key={memberId}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => toggleUser(memberId)}
                                                        className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer select-none ${i % 2 === 1 ? 'bg-muted/20' : ''}`}
                                                    >
                                                        <td className="py-2 px-3">
                                                            <Avatar className="w-9 h-9">
                                                                <AvatarImage src={member.memberImage} />
                                                                <AvatarFallback className="text-xs">
                                                                    {(member.memberName || member.memberEmail)?.[0]}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </td>
                                                        <td className="py-2 px-3 font-medium truncate max-w-[200px]">
                                                            {member.memberName || member.memberEmail}
                                                        </td>
                                                        <td className="py-2 px-3 text-muted-foreground truncate max-w-[180px]">
                                                            {member.memberEmail}
                                                        </td>
                                                        <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <Checkbox
                                                                checked={selectedUserIds.includes(memberId)}
                                                                onCheckedChange={() => toggleUser(memberId)}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabsContent>
                </div>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
                {onClose && (
                    <Button variant="outline" onClick={onClose}>
                        {t('subDialog.cancel')}
                    </Button>
                )}
                {!isTrial && (
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('subDialog.save')}
                    </Button>
                )}
            </div>

            <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
                <AlertDialogContent className="bg-white dark:bg-background border-border">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('subDialog.limitReached')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('subDialog.limitDesc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
                            {t('common.close')}
                        </Button>
                        {onUpgrade && (
                            <Button
                                onClick={() => {
                                    setShowUpgradeDialog(false);
                                    onUpgrade();
                                }}
                            >
                                {t('subDialog.viewPlans')}
                            </Button>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
