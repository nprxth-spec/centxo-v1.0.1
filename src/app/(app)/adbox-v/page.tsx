'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Search,
  MessageCircle,
  RefreshCw,
  Loader2,
  Settings,
  Send,
  Bell,
  BellOff,
  Ban,
  Image,
  FileText,
  Mail,
  User,
  Plus,
  Megaphone,
  X,
  Bookmark,
  Link2,
  AlertTriangle,
  ExternalLink,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  fetchPages,
  fetchConversationsFromDB,
  fetchMessagesFromDB,
  sendReply,
  syncConversationsOnce,
  syncMessagesOnce,
  markConversationAsRead,
  updateConversationViewer,
  markConversationAsUnread,
} from '@/app/actions/adbox';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppSettings } from '@/hooks/useAppSettings';

const createNotificationSound = () => {
  if (typeof window === 'undefined') return null;
  const audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
  return () => {
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    [880, 1108.73].forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.5);
    });
  };
};

export default function AdBoxVPage() {
  const { t } = useLanguage();
  const { notificationsEnabled, soundEnabled } = useAppSettings();

  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [pages, setPages] = useState<Array<{ id: string; name: string; access_token?: string; picture?: { data?: { url?: string } } }>>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedPageIds');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [tempSelectedPageIds, setTempSelectedPageIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Record<string, unknown> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(true);
  const [detailTab, setDetailTab] = useState('info');
  const [customerNote, setCustomerNote] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedConversationRef = useRef(selectedConversation);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const currentConversationIdRef = useRef<string | null>(null);
  const [messageCache, setMessageCache] = useState<Record<string, Record<string, unknown>[]>>({});
  const notificationSoundRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('seenMessageIds');
      if (stored) seenMessageIds.current = new Set(JSON.parse(stored).slice(-100));
    } catch {}
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('selectedPageIds', JSON.stringify(selectedPageIds));
  }, [selectedPageIds]);

  useEffect(() => {
    notificationSoundRef.current = createNotificationSound();
  }, []);

  const playNotificationSound = useCallback(() => {
    if (soundEnabled && notificationSoundRef.current) notificationSoundRef.current();
  }, [soundEnabled]);

  const showNotification = useCallback(
    (title: string, body: string) => {
      if (!notificationsEnabled || !('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    },
    [notificationsEnabled]
  );

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPages();
      setPages(data);
      setHasToken(true);
      if (data.length > 0 && selectedPageIds.length === 0) {
        const saved = localStorage.getItem('selectedPageIds');
        if (!saved || JSON.parse(saved).length === 0) setSelectedPageIds([data[0].id]);
      }
    } catch (e) {
      console.error('Failed to load pages', e);
      setHasToken(false);
    } finally {
      setLoading(false);
    }
  }, [selectedPageIds.length]);

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (selectedPageIds.length > 0 && hasToken) {
      loadConversations(selectedPageIds, true);
    } else {
      setConversations([]);
    }
  }, [selectedPageIds, hasToken]);

  useEffect(() => {
    if (selectedConversation && hasToken) {
      currentConversationIdRef.current = (selectedConversation.id as string) || null;
      if (messageCache[selectedConversation.id as string]) {
        setMessages(messageCache[selectedConversation.id as string]);
      } else {
        setMessages([]);
      }
      loadMessages(
        selectedConversation.id as string,
        selectedConversation.pageId as string,
        true
      );
      markConversationAsRead(selectedConversation.id as string).then(() => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id ? { ...c, unread_count: 0 } : c
          )
        );
      });
    }
  }, [selectedConversation?.id, hasToken]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isDialogOpen) setTempSelectedPageIds(selectedPageIds);
  }, [isDialogOpen, selectedPageIds]);

  // Poll for new messages
  useEffect(() => {
    if (selectedPageIds.length === 0 || !isInitialized || !hasToken) return;
    let isActive = true;
    let lastSyncTime = new Date().toISOString();
    const poll = async () => {
      if (!isActive) return;
      try {
        const res = await fetch(
          `/api/messages/sync-new?pageIds=${selectedPageIds.join(',')}&since=${lastSyncTime}`
        );
        if (res.ok) {
          const data = await res.json();
          lastSyncTime = new Date().toISOString();
          if (data.newMessages?.length > 0) {
            const newMsgs = data.newMessages.filter(
              (m: { id: string }) => !seenMessageIds.current.has(m.id)
            );
            if (newMsgs.length > 0) {
              newMsgs.forEach((m: { id: string }) => seenMessageIds.current.add(m.id));
              playNotificationSound();
              const first = newMsgs[0];
              showNotification(
                t('adbox.newMessage', 'New message'),
                `${first.senderName}: ${(first.content || '').toString().slice(0, 50)}`
              );
              setToastMessage(`${first.senderName}: ${(first.content || '').toString().slice(0, 50)}`);
              setTimeout(() => setToastMessage(null), 5000);
            }
          }
          if (data.updatedConversations?.length > 0) {
            setConversations((prev) => {
              const updated = [...prev];
              for (const conv of data.updatedConversations) {
                const idx = updated.findIndex((c) => c.id === conv.id);
                const cur = selectedConversationRef.current;
                const unread = cur?.id === conv.id ? 0 : conv.unread_count;
                if (idx >= 0) {
                  updated[idx] = { ...updated[idx], ...conv, unread_count: unread };
                } else {
                  updated.push({ ...conv, unread_count: unread });
                }
              }
              return updated.sort(
                (a, b) =>
                  new Date((b.updated_time as string) || 0).getTime() -
                  new Date((a.updated_time as string) || 0).getTime()
              );
            });
          }
        }
      } catch {}
      if (isActive) setTimeout(poll, 3000);
    };
    poll();
    return () => {
      isActive = false;
    };
  }, [selectedPageIds, isInitialized, hasToken, playNotificationSound, showNotification, t]);

  const loadConversations = async (pageIds: string[], forceSync = false) => {
    setLoadingChat(true);
    let hasData = false;
    try {
      const dbData = await fetchConversationsFromDB(pageIds);
      if (dbData.length > 0) {
        setConversations(dbData);
        hasData = true;
        setLoadingChat(false);
      }
    } catch {}

    if (forceSync) {
      const syncTask = async () => {
        try {
          let pagesData = pages;
          if (pagesData.length === 0) {
            pagesData = await fetchPages();
            setPages(pagesData);
          }
          const selectedPages = pagesData.filter((p) => pageIds.includes(p.id));
          if (selectedPages.length === 0) {
            setToastMessage('No pages selected. Please select pages first.');
            setTimeout(() => setToastMessage(null), 4000);
            return;
          }
          const data = await syncConversationsOnce(
            selectedPages.map((p) => ({ id: p.id, access_token: p.access_token }))
          );
          if (data.length > 0) setConversations(data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Sync failed';
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 6000);
          console.error('AdBox sync error:', err);
        }
        if (!hasData) setLoadingChat(false);
      };
      hasData ? syncTask() : await syncTask();
    } else if (!hasData) {
      setLoadingChat(false);
    }
  };

  const loadMessages = async (conversationId: string, pageId: string, forceSync = false) => {
    if (messages.length === 0) setLoadingMessages(true);
    let hasData = false;
    try {
      const dbData = await fetchMessagesFromDB(conversationId);
      if (currentConversationIdRef.current !== conversationId) return;
      if (dbData.length > 0) {
        setMessages(dbData);
        setMessageCache((prev) => ({ ...prev, [conversationId]: dbData }));
        hasData = true;
        setLoadingMessages(false);
      } else {
        forceSync = true;
      }
    } catch {}

    if (forceSync) {
      const syncTask = async () => {
        try {
          const page = pages.find((p) => p.id === pageId);
          await syncMessagesOnce(conversationId, pageId, page?.access_token);
          if (currentConversationIdRef.current !== conversationId) return;
          const updated = await fetchMessagesFromDB(conversationId);
          if (updated.length > 0) {
            setMessages(updated);
            setMessageCache((prev) => ({ ...prev, [conversationId]: updated }));
          }
        } catch {}
        if (currentConversationIdRef.current === conversationId && !hasData)
          setLoadingMessages(false);
      };
      hasData ? syncTask() : await syncTask();
    } else if (currentConversationIdRef.current === conversationId && !hasData) {
      setLoadingMessages(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConversation) return;
    const currentReply = replyText;
    setReplyText('');
    setSending(true);
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      message: currentReply,
      from: { name: 'Me', id: selectedConversation.pageId },
      created_time: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    try {
      const recipientId = (selectedConversation.participants as { data?: { id?: string }[] })
        ?.data?.[0]?.id;
      if (!recipientId) return;
      const result = await sendReply(
        selectedConversation.pageId as string,
        recipientId,
        currentReply,
        selectedConversation.id as string
      );
      if (result.success) {
        const realId = (result.data as { message_id?: string })?.message_id;
        if (realId) {
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticMsg.id ? { ...m, id: realId } : m))
          );
        }
        const dbMessages = await fetchMessagesFromDB(selectedConversation.id as string);
        if (dbMessages.length > 0) setMessages(dbMessages);
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      }
    } catch {
      const dbMessages = await fetchMessagesFromDB(selectedConversation.id as string);
      if (dbMessages.length > 0) setMessages(dbMessages);
    } finally {
      setSending(false);
    }
  };

  const getFallbackAvatar = (name: string) => {
    const colors = [
      { bg: '3b82f6', fg: 'fff' },
      { bg: '10b981', fg: 'fff' },
      { bg: 'f59e0b', fg: 'fff' },
      { bg: 'ef4444', fg: 'fff' },
      { bg: '8b5cf6', fg: 'fff' },
    ];
    let hash = 0;
    for (let i = 0; i < (name || 'U').length; i++)
      hash = (name || 'U').charCodeAt(i) + ((hash << 5) - hash);
    const c = colors[Math.abs(hash) % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=${c.bg}&color=${c.fg}&size=100`;
  };

  const toggleTempPageSelection = (pageId: string) => {
    setTempSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };
  const toggleTempSelectAll = () => {
    setTempSelectedPageIds(
      tempSelectedPageIds.length === pages.length ? [] : pages.map((p) => p.id)
    );
  };
  const handleSaveSelection = () => {
    setSelectedPageIds(tempSelectedPageIds);
    setIsDialogOpen(false);
  };
  const getPageDetails = (pageId: string) => pages.find((p) => p.id === pageId);

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();
    if (isToday)
      return date
        .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        .replace('AM', 'am')
        .replace('PM', 'pm');
    if (isYesterday) {
      const timeStr = date
        .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        .replace('AM', 'am')
        .replace('PM', 'pm');
      return `${timeStr} yesterday`;
    }
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  if (loading && hasToken === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 px-4">
        <MessageCircle className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t('adbox.connectFacebook')}</h2>
        <p className="text-muted-foreground text-center max-w-md">{t('adbox.connectDescription')}</p>
        <Link href="/settings/connections">
          <Button>Go to Settings</Button>
        </Link>
      </div>
    );
  }

  const filteredConvs = conversations.filter((conv) => {
    if (filterStatus === 'unread' && ((conv.unread_count as number) || 0) === 0) return false;
    if (filterStatus === 'read' && ((conv.unread_count as number) || 0) > 0) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = ((conv.participants as { data?: { name?: string }[] })?.data?.[0]?.name || '').toLowerCase();
      const snippet = ((conv.snippet as string) || '').toLowerCase();
      if (!name.includes(q) && !snippet.includes(q)) return false;
    }
    return true;
  });
  const sortedConvs = [...filteredConvs].sort(
    (a, b) =>
      new Date((b.updated_time as string) || 0).getTime() -
      new Date((a.updated_time as string) || 0).getTime()
  );

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col px-4 md:px-8 pt-2 pb-0">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm animate-in slide-in-from-top-2">
          <Bell className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1 truncate text-sm">{toastMessage}</div>
          <button onClick={() => setToastMessage(null)} className="opacity-80 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-row gap-3 overflow-hidden">
        {/* Left: Conversation list */}
        <Card className="w-full max-w-[380px] flex-shrink-0 flex flex-col rounded-2xl overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">{t('adbox.chat')}</span>
            <div className="flex gap-1">
              <Link href="/settings/connections">
                <Button variant="ghost" size="icon" title="Connections">
                  <Link2 className="h-4 w-4" />
                </Button>
              </Link>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" title="Select pages">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('adbox.selectPages')}</DialogTitle>
                    <DialogDescription>{t('adbox.choosePages')}</DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <div className="flex justify-between mb-4">
                      <span className="text-sm text-muted-foreground">
                        {pages.length} {t('adbox.pagesAvailable')}
                      </span>
                      <Button variant="ghost" size="sm" onClick={toggleTempSelectAll}>
                        {tempSelectedPageIds.length === pages.length
                          ? t('adbox.deselectAll')
                          : t('adbox.selectAll')}
                      </Button>
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {pages.map((page) => (
                          <div
                            key={page.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                              tempSelectedPageIds.includes(page.id) ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted'
                            }`}
                            onClick={() => toggleTempPageSelection(page.id)}
                          >
                            <Checkbox
                              checked={tempSelectedPageIds.includes(page.id)}
                              onCheckedChange={() => toggleTempPageSelection(page.id)}
                            />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={page.picture?.data?.url} />
                              <AvatarFallback>{page.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium truncate text-sm">{page.name}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      {t('adbox.cancel')}
                    </Button>
                    <Button onClick={handleSaveSelection}>{t('adbox.applyChanges')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => loadConversations(selectedPageIds, true)}
                disabled={loadingChat}
              >
                <RefreshCw className={`h-4 w-4 ${loadingChat ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="p-2 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('adbox.search')}
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'unread', 'read'] as const).map((f) => (
                <Button
                  key={f}
                  variant={filterStatus === f ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={() => setFilterStatus(f)}
                >
                  {t(`adbox.${f}`)}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loadingChat ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedConvs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p>No conversations</p>
              </div>
            ) : (
              sortedConvs.map((conv) => {
                const unreadCount = Number(conv.unread_count || 0);
                const isUnread = unreadCount > 0;
                const isSelected = selectedConversation?.id === conv.id;
                const participant = (conv.participants as { data?: { id?: string; name?: string }[] })
                  ?.data?.[0];

                return (
                  <div
                    key={conv.id as string}
                    className={`grid grid-cols-[auto_1fr_auto] gap-3 p-3 cursor-pointer border-l-2 transition-colors ${
                      isSelected ? 'bg-primary/10 border-l-primary' : isUnread ? 'hover:bg-muted' : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      setSelectedConversation(conv);
                      setConversations((prev) =>
                        prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
                      );
                      if (unreadCount > 0) markConversationAsRead(conv.id as string);
                      updateConversationViewer(conv.id as string);
                    }}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={getFallbackAvatar(participant?.name || 'U')}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getFallbackAvatar(
                              participant?.name || 'U'
                            );
                          }}
                        />
                        <AvatarFallback>{(participant?.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {isUnread && (
                        <span className="absolute bottom-0 right-0 h-5 w-5 bg-red-500 rounded-full border-2 border-background flex items-center justify-center text-[10px] text-white font-bold">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col justify-center gap-1">
                      <span
                        className={`text-sm truncate ${isUnread ? 'font-semibold' : 'font-medium'}`}
                      >
                        {participant?.name || 'Facebook User'}
                      </span>
                      <span className={`text-xs truncate ${isUnread ? 'font-medium' : 'text-muted-foreground'}`}>
                        {(conv.snippet as string) || 'No message'}
                      </span>
                    </div>
                    <span
                      className={`text-xs whitespace-nowrap ${isUnread ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                    >
                      {formatTime(conv.updated_time as string)}
                    </span>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </Card>

        {/* Middle: Chat */}
        <Card className="flex-1 flex flex-col min-w-0 rounded-2xl overflow-hidden">
          {selectedConversation ? (
            <>
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={getFallbackAvatar(
                        (selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]
                          ?.name || 'U'
                      )}
                    />
                    <AvatarFallback>
                      {(selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]
                        ?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm">
                    {(selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]
                      ?.name || 'Unknown'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!selectedConversation) return;
                    await markConversationAsUnread(selectedConversation.id as string);
                    setConversations((prev) =>
                      prev.map((c) =>
                        c.id === selectedConversation.id ? { ...c, unread_count: 1 } : c
                      )
                    );
                    setSelectedConversation(null);
                  }}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Mark unread
                </Button>
              </div>

              <div
                className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30"
                ref={scrollRef}
                style={{ minHeight: 0 }}
              >
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length > 0 ? (
                  <>
                    {messages.map((msg) => {
                      const isMe =
                        (msg.from as { id?: string })?.id === selectedConversation.pageId;
                      return (
                        <div
                          key={msg.id as string}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                              isMe
                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                : 'bg-background shadow rounded-bl-none'
                            }`}
                          >
                            {msg.message as string}
                            <div
                              className={`text-[10px] mt-1 text-right ${
                                isMe ? 'opacity-80' : 'text-muted-foreground'
                              }`}
                            >
                              {new Date(
                                (msg.created_time as string) || 0
                              ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Start the conversation</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={t('adbox.typeMessage')}
                      className="min-h-[44px] max-h-[120px] py-3 pr-12 resize-none rounded-xl"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    size="icon"
                    className="h-11 w-11 rounded-xl"
                  >
                    {sending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
              <MessageCircle className="h-12 w-12 mb-4 text-primary/50" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                {t('adbox.selectConversation')}
              </h3>
              <p className="text-sm text-center max-w-xs">
                Select a chat from the list to start a conversation
              </p>
            </div>
          )}
        </Card>

        {/* Right: Detail panel (simplified) */}
        {selectedConversation && showDetailPanel && (
          <Card className="w-[280px] flex-shrink-0 flex flex-col rounded-2xl overflow-hidden">
            <div className="flex border-b">
              <button
                className={`flex-1 py-3 text-sm font-medium ${detailTab === 'info' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                onClick={() => setDetailTab('info')}
              >
                Info
              </button>
              <button
                className={`flex-1 py-3 text-sm font-medium ${detailTab === 'conversation' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                onClick={() => setDetailTab('conversation')}
              >
                Details
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setShowDetailPanel(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detailTab === 'conversation' && (
                <>
                  <div className="text-center">
                    <Avatar className="h-16 w-16 mx-auto mb-2">
                      <AvatarFallback className="text-lg">
                        {(selectedConversation.participants as { data?: { name?: string }[] })
                          ?.data?.[0]
                          ?.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <h4 className="font-semibold">
                      {(selectedConversation.participants as { data?: { name?: string }[] })
                        ?.data?.[0]
                        ?.name || 'Unknown'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      ID:{' '}
                      {(selectedConversation.participants as { data?: { id?: string }[] })?.data?.[0]
                        ?.id || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Messages: <strong>{messages.length}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Page:{' '}
                        <strong>
                          {getPageDetails(selectedConversation.pageId as string)?.name || 'Unknown'}
                        </strong>
                      </span>
                    </div>
                  </div>
                  {selectedConversation.facebookLink && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        window.open(selectedConversation.facebookLink as string, '_blank')
                      }
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on Facebook
                    </Button>
                  )}
                </>
              )}
              {detailTab === 'info' && (
                <div className="text-center text-muted-foreground text-sm">
                  <p>Notes and orders coming soon</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
