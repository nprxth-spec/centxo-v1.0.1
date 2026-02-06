'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Mail,
  User,
  Megaphone,
  X,
  Link2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  fetchConversationsFromDB,
  fetchMessagesFromDB,
  sendReply,
  syncConversationsOnce,
  syncMessagesOnce,
  markConversationAsRead,
  updateConversationViewer,
  markConversationAsUnread,
} from '@/app/actions/adbox';
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
import { useConfig } from '@/contexts/AdAccountContext';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

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

export default function AdBoxPage() {
  const { t } = useLanguage();
  const { notificationsEnabled, soundEnabled } = useAppSettings();
  const { selectedPages: configSelectedPages, loading: configLoading } = useConfig();

  // Pages come from Settings > Connections > Ad Accounts > Pages selection
  const pages = configSelectedPages.map((p) => ({
    id: p.id,
    name: p.name,
    access_token: p.access_token,
    picture: p.picture,
  }));

  const [selectedPageIds, setSelectedPageIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adbox_selectedPageIds');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adbox_selectionMode');
      return (saved === 'single' || saved === 'multi') ? saved : 'multi';
    }
    return 'multi';
  });
  const [tempSelectedPageIds, setTempSelectedPageIds] = useState<string[]>([]);
  const [tempSelectionMode, setTempSelectionMode] = useState<'single' | 'multi'>('multi');

  const [hasToken, setHasToken] = useState<boolean | null>(null);
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [adDetails, setAdDetails] = useState<{
    name: string | null;
    thumbnailUrl: string | null;
    title: string | null;
    body: string | null;
  } | null>(null);
  const adDetailsCache = useRef<Record<string, typeof adDetails>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedConversationRef = useRef(selectedConversation);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const currentConversationIdRef = useRef<string | null>(null);
  const [messageCache, setMessageCache] = useState<Record<string, Record<string, unknown>[]>>({});
  const notificationSoundRef = useRef<(() => void) | null>(null);
  const shouldScrollToBottomRef = useRef(true);
  const lastMessageCountRef = useRef(0);

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

  useEffect(() => {
    if (!configLoading) {
      setHasToken(pages.length > 0);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [configLoading, pages.length]);

  // Sync selection when pages load - keep only valid ids, init if empty
  const pageIdsStr = pages.map((p) => p.id).join(',');
  useEffect(() => {
    if (pages.length === 0) return;
    const validIds = new Set(pages.map((p) => p.id));
    setSelectedPageIds((prev) => {
      const filtered = prev.filter((id) => validIds.has(id));
      if (filtered.length === 0) {
        return selectionMode === 'single' ? [pages[0].id] : pages.map((p) => p.id);
      }
      return filtered;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdsStr]);

  // Persist selection
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedPageIds.length > 0) {
      localStorage.setItem('adbox_selectedPageIds', JSON.stringify(selectedPageIds));
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('adbox_selectionMode', selectionMode);
    }
  }, [selectedPageIds, selectionMode]);

  // Effective page ids for loading (single = first only, multi = all selected)
  const effectivePageIds = selectionMode === 'single' && selectedPageIds.length > 0
    ? [selectedPageIds[0]]
    : selectedPageIds.filter((id) => pages.some((p) => p.id === id));

  useEffect(() => {
    if (effectivePageIds.length > 0 && hasToken) {
      loadConversations(effectivePageIds, false);
    } else {
      setConversations([]);
    }
  }, [effectivePageIds.join(','), hasToken]);

  useEffect(() => {
    if (selectedConversation && hasToken) {
      currentConversationIdRef.current = (selectedConversation.id as string) || null;
      const cached = messageCache[selectedConversation.id as string];
      if (cached) {
        setMessages(cached);
        lastMessageCountRef.current = cached.length;
      } else {
        setMessages([]);
        lastMessageCountRef.current = 0;
      }
      loadMessages(
        selectedConversation.id as string,
        selectedConversation.pageId as string,
        false
      );
      markConversationAsRead(selectedConversation.id as string).then(() => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id ? { ...c, unread_count: 0 } : c
          )
        );
      });
      updateConversationViewer(selectedConversation.id as string);
    }
  }, [selectedConversation?.id, hasToken]);

  // Fetch ad details when conversation has adId (to show which ad post customer messaged from)
  useEffect(() => {
    const adId = selectedConversation?.adId as string | undefined;
    if (!adId) {
      setAdDetails(null);
      return;
    }
    const cached = adDetailsCache.current[adId];
    if (cached) {
      setAdDetails(cached);
      return;
    }
    setAdDetails(null);
    fetch(`/api/adbox/ad/${encodeURIComponent(adId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ad) {
          const details = {
            name: data.ad.name || null,
            thumbnailUrl: data.ad.thumbnailUrl || null,
            title: data.ad.title || null,
            body: data.ad.body || null,
          };
          adDetailsCache.current[adId] = details;
          if (selectedConversationRef.current?.adId === adId) {
            setAdDetails(details);
          }
        }
      })
      .catch(() => {});
  }, [selectedConversation?.adId]);

  // Only scroll to bottom when appropriate (not on every poll refresh)
  useEffect(() => {
    if (!scrollRef.current || !shouldScrollToBottomRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    shouldScrollToBottomRef.current = false;
  }, [messages]);

  // Reset scroll-to-bottom when switching conversation
  useEffect(() => {
    if (selectedConversation) {
      shouldScrollToBottomRef.current = true;
      lastMessageCountRef.current = 0;
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (effectivePageIds.length === 0 || !isInitialized || !hasToken) return;
    let isActive = true;
    let lastSyncTime = new Date(Date.now() - 120000).toISOString();
    const SYNC_POLL_MS = 3000;
    const poll = async () => {
      if (!isActive) return;
      try {
        const res = await fetch(
          `/api/messages/sync-new?pageIds=${effectivePageIds.join(',')}&since=${lastSyncTime}`
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
              const cur = selectedConversationRef.current;
              const convId = cur?.id as string | undefined;
              const pageId = cur?.pageId as string | undefined;
              const participantId = (cur?.participants as { data?: { id?: string }[] })?.data?.[0]?.id;
              const belongsToOpenChat = convId && newMsgs.some(
                (m: { conversationId?: string; pageId?: string; senderId?: string }) =>
                  m.conversationId === convId ||
                  (pageId && participantId && m.pageId === pageId && m.senderId === participantId)
              );
              if (belongsToOpenChat && convId) {
                shouldScrollToBottomRef.current = true;
                fetchMessagesFromDB(convId).then((fresh) => {
                  if (currentConversationIdRef.current === convId) {
                    setMessages(fresh);
                    setMessageCache((prev) => ({ ...prev, [convId]: fresh }));
                    lastMessageCountRef.current = fresh.length;
                  }
                });
              }
            }
          }
          if (data.updatedConversations?.length > 0) {
            const cur = selectedConversationRef.current;
            for (const conv of data.updatedConversations) {
              if (cur?.id === conv.id) {
                setSelectedConversation((s) => (s?.id === conv.id ? { ...s, ...conv } : s));
                break;
              }
            }
            setConversations((prev) => {
              const updated = [...prev];
              for (const conv of data.updatedConversations) {
                const idx = updated.findIndex((c) => c.id === conv.id);
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
      if (isActive) setTimeout(poll, SYNC_POLL_MS);
    };
    poll();
    return () => {
      isActive = false;
    };
  }, [selectedPageIds, isInitialized, hasToken, playNotificationSound, showNotification, t]);

  useEffect(() => {
    const convId = selectedConversation?.id as string | undefined;
    const pageId = selectedConversation?.pageId as string | undefined;
    if (!convId || !pageId || !hasToken) return;
    let isActive = true;
    let liveSyncCount = 0;
    const POLL_INTERVAL = 3000;
    const fastPoll = async () => {
      if (!isActive || currentConversationIdRef.current !== convId) return;
      try {
        const url =
          liveSyncCount % 10 === 0
            ? `/api/adbox/messages/live?conversationId=${encodeURIComponent(convId)}&pageId=${encodeURIComponent(pageId)}`
            : `/api/adbox/messages?conversationId=${encodeURIComponent(convId)}`;
        const res = await fetch(url);
        if (res.ok) {
          const { messages: fresh } = await res.json();
          if (Array.isArray(fresh) && isActive && currentConversationIdRef.current === convId) {
            const prevCount = lastMessageCountRef.current;
            const newCount = fresh.length;
            const hasNewMessages = newCount > prevCount;
            setMessages(fresh);
            setMessageCache((c) => ({ ...c, [convId]: fresh }));
            lastMessageCountRef.current = newCount;
            if (hasNewMessages && scrollRef.current) {
              const el = scrollRef.current;
              const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              if (nearBottom) shouldScrollToBottomRef.current = true;
            }
          }
        }
        liveSyncCount += 1;
      } catch {}
      if (isActive) setTimeout(fastPoll, POLL_INTERVAL);
    };
    const t = setTimeout(fastPoll, 500);
    return () => {
      isActive = false;
      clearTimeout(t);
    };
  }, [selectedConversation?.id, selectedConversation?.pageId, hasToken]);

  const loadConversations = async (pageIds: string[], forceSync = false) => {
    setLoadingChat(true);
    let hasData = false;
    try {
      const dbData = await fetchConversationsFromDB(pageIds);
      if (dbData.length > 0) {
        setConversations(dbData);
        hasData = true;
      }
      setLoadingChat(false);
    } catch {
      setLoadingChat(false);
    }

    const syncTask = async () => {
      try {
        const selectedPages = pages.filter((p) => pageIds.includes(p.id));
        if (selectedPages.length === 0) return;
        await syncConversationsOnce(
          selectedPages.map((p) => ({ id: p.id, access_token: p.access_token }))
        );
        const merged = await fetchConversationsFromDB(pageIds);
        if (merged.length > 0) {
          setConversations(merged);
          setSelectedConversation((s) => {
            if (!s) return s;
            const updated = merged.find((c) => c.id === s.id);
            if (updated && (updated.adId !== s.adId || updated.facebookLink !== s.facebookLink))
              return { ...s, ...updated };
            return s;
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 6000);
        console.error('AdBox sync error:', err);
      }
    };

    if (forceSync) {
      syncTask();
    } else {
      setTimeout(syncTask, 800);
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
        lastMessageCountRef.current = dbData.length;
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
            lastMessageCountRef.current = updated.length;
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
    shouldScrollToBottomRef.current = true;
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

  const getPageDetails = (pageId: string) => pages.find((p) => p.id === pageId);

  const handleOpenSelectDialog = (open: boolean) => {
    setIsDialogOpen(open);
    if (open) {
      setTempSelectedPageIds([...selectedPageIds]);
      setTempSelectionMode(selectionMode);
    }
  };

  const toggleTempPage = (pageId: string) => {
    if (tempSelectionMode === 'single') {
      setTempSelectedPageIds([pageId]);
    } else {
      setTempSelectedPageIds((prev) =>
        prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
      );
    }
  };

  const toggleTempSelectAll = () => {
    if (tempSelectedPageIds.length === pages.length) {
      setTempSelectedPageIds([]);
    } else {
      setTempSelectedPageIds(pages.map((p) => p.id));
    }
  };

  const handleSavePageSelection = () => {
    const ids = tempSelectedPageIds.length > 0 ? tempSelectedPageIds : (pages[0] ? [pages[0].id] : []);
    setSelectedPageIds(ids);
    setSelectionMode(tempSelectionMode);
    setIsDialogOpen(false);
  };

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

  if (!hasToken && !configLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 px-4">
        <MessageCircle className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{pages.length === 0 ? t('adbox.selectPages') : t('adbox.connectFacebook')}</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {pages.length === 0
            ? 'Select pages in Settings > Connections > Ad Accounts to manage Messenger conversations.'
            : t('adbox.connectDescription')}
        </p>
        <Link href="/settings/connections?tab=ad-accounts&view=pages">
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

  const getParticipantPictureUrl = (participantId?: string, pageId?: string) => {
    if (!participantId || !pageId) return null;
    return `/api/adbox/participant-picture?participantId=${encodeURIComponent(participantId)}&pageId=${encodeURIComponent(pageId)}`;
  };

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

      <div className="flex-1 flex flex-row overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="w-full max-w-[380px] flex-shrink-0 flex flex-col border-r overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">{t('adbox.chat')}</span>
            <div className="flex gap-1">
              <Link href="/settings/connections">
                <Button variant="ghost" size="icon" title="Connections">
                  <Link2 className="h-4 w-4" />
                </Button>
              </Link>
              <Dialog open={isDialogOpen} onOpenChange={handleOpenSelectDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" title="Select pages">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('adbox.selectPages')}</DialogTitle>
                    <DialogDescription>
                      Choose Single page or Multi pages. Pages are from Settings.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Link href="/settings/connections?tab=ad-accounts&view=pages">
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4 mr-2" />
                          Manage in Settings
                        </Button>
                      </Link>
                    </div>
                    <RadioGroup
                      value={tempSelectionMode}
                      onValueChange={(v) => {
                        const mode = v as 'single' | 'multi';
                        setTempSelectionMode(mode);
                        if (mode === 'single' && tempSelectedPageIds.length > 1) {
                          setTempSelectedPageIds([tempSelectedPageIds[0]]);
                        }
                      }}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="single" id="single" />
                        <Label htmlFor="single" className="cursor-pointer font-normal">Single page</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="multi" id="multi" />
                        <Label htmlFor="multi" className="cursor-pointer font-normal">Multi pages</Label>
                      </div>
                    </RadioGroup>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {tempSelectedPageIds.length} of {pages.length} selected
                      </span>
                      {tempSelectionMode === 'multi' && (
                        <Button variant="ghost" size="sm" onClick={toggleTempSelectAll}>
                          {tempSelectedPageIds.length === pages.length ? 'Deselect all' : 'Select all'}
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="h-[260px]">
                      <div className="space-y-2">
                        {pages.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            No pages selected. Go to Settings to select pages.
                          </div>
                        ) : (
                          pages.map((page) => {
                            const isSelected = tempSelectedPageIds.includes(page.id);
                            return (
                              <div
                                key={page.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50'
                                }`}
                                onClick={() => toggleTempPage(page.id)}
                              >
                                {tempSelectionMode === 'single' ? (
                                  <div
                                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                                    }`}
                                  />
                                ) : (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleTempPage(page.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-shrink-0"
                                  />
                                )}
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={(page.picture as { data?: { url?: string } })?.data?.url} />
                                  <AvatarFallback>{page.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium truncate text-sm flex-1">{page.name}</span>
                                {isSelected && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      {t('adbox.cancel')}
                    </Button>
                    <Button onClick={handleSavePageSelection} disabled={tempSelectedPageIds.length === 0}>
                      Apply
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => loadConversations(effectivePageIds, true)}
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
                const fallbackUrl = getFallbackAvatar(participant?.name || 'U');
                const showRealPicture = isSelected && participant?.id && conv.pageId;
                const pictureUrl = showRealPicture ? getParticipantPictureUrl(participant.id, conv.pageId as string) : null;

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
                          src={pictureUrl || fallbackUrl}
                          onError={(e) => {
                            const el = e.target as HTMLImageElement;
                            if (el.src !== fallbackUrl) el.src = fallbackUrl;
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
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedConversation ? (
            <>
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={getParticipantPictureUrl(
                        (selectedConversation.participants as { data?: { id?: string }[] })?.data?.[0]?.id,
                        selectedConversation.pageId as string
                      ) || getFallbackAvatar(
                        (selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]
                          ?.name || 'U'
                      )}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getFallbackAvatar(
                          (selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]
                            ?.name || 'U'
                        );
                      }}
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
                {(selectedConversation.adId as string) && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 text-sm mb-3 overflow-hidden">
                    <div className="flex items-start gap-3 p-3">
                      {adDetails?.thumbnailUrl ? (
                        <img
                          src={adDetails.thumbnailUrl}
                          alt=""
                          className="w-16 h-16 rounded object-cover flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <Megaphone className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          {t('adbox.fromAd', 'From Ad')} · ID: {selectedConversation.adId as string}
                        </p>
                        <p className="font-medium text-foreground truncate">
                          {adDetails?.name || adDetails?.title || t('adbox.adPost', 'Ad post')}
                        </p>
                        {adDetails?.body && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {adDetails.body}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 pb-2 pt-0">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedConversation.adId as string);
                          setToastMessage(`Ad ID copied: ${selectedConversation.adId}`);
                          setTimeout(() => setToastMessage(null), 2000);
                        }}
                        className="text-primary hover:underline text-xs"
                      >
                        Copy ID
                      </button>
                      <Link
                        href={`/ads-manager/campaigns?adId=${selectedConversation.adId}`}
                        className="text-primary hover:underline text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View in Ads
                      </Link>
                    </div>
                  </div>
                )}
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mb-3" />
                    <p>{t('adbox.loadingMessages', 'กำลังโหลดข้อความ')}</p>
                  </div>
                ) : messages.length > 0 ? (
                  <>
                    {messages.map((msg) => {
                      const isFromUs =
                        (msg.from as { id?: string })?.id === selectedConversation.pageId;
                      const content = msg.message as string;
                      const stickerUrl = msg.stickerUrl as string | null | undefined;
                      let attachments: { type?: string; url?: string }[] = [];
                      try {
                        if (msg.attachments && typeof msg.attachments === 'string') {
                          attachments = JSON.parse(msg.attachments) || [];
                        }
                      } catch {}
                      const imageAtts = attachments.filter((a) => {
                        if (!a.url) return false;
                        const t = (a.type || '').toLowerCase();
                        return t === 'image' || t === 'photo' || (t !== 'sticker' && t !== 'video' && t !== 'audio');
                      });
                      const isPlaceholder = content === '[Sticker]' || content === '[Image]' || content === '[Attachment]';
                      const timeStr = (() => {
                        const d = new Date((msg.created_time as string) || 0);
                        if (isNaN(d.getTime())) return '';
                        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
                      })();

                      return (
                        <div
                          key={msg.id as string}
                          className={`group flex items-start gap-2 ${isFromUs ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`flex max-w-[85%] items-end gap-2 ${isFromUs ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            <div
                              className={`px-4 py-2 rounded-2xl text-sm ${
                                isFromUs
                                  ? 'bg-primary text-primary-foreground rounded-br-none'
                                  : 'bg-background shadow rounded-bl-none'
                              }`}
                            >
                              {stickerUrl ? (
                                <img
                                  src={stickerUrl}
                                  alt="Sticker"
                                  className="max-w-[120px] max-h-[120px] object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              ) : imageAtts.length > 0 ? (
                                <div className="space-y-2">
                                  {imageAtts.map((att, i) => (
                                    <img
                                      key={i}
                                      src={att.url}
                                      alt=""
                                      className="max-w-full max-h-[240px] rounded-lg object-contain"
                                      referrerPolicy="no-referrer"
                                    />
                                  ))}
                                </div>
                              ) : null}
                              {(!isPlaceholder || (!stickerUrl && imageAtts.length === 0)) && content ? (
                                <span className={stickerUrl || imageAtts.length ? 'block mt-2' : ''}>
                                  {content}
                                </span>
                              ) : null}
                            </div>
                            {timeStr && (
                              <span
                                title={timeStr}
                                className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shrink-0"
                              >
                                {timeStr}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>{t('adbox.startConversation', 'Start the conversation')}</p>
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
        </div>

        {selectedConversation && showDetailPanel && (
          <div className="w-[280px] flex-shrink-0 flex flex-col border-l overflow-hidden">
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
                      <AvatarImage
                        src={getParticipantPictureUrl(
                          (selectedConversation.participants as { data?: { id?: string }[] })?.data?.[0]?.id,
                          selectedConversation.pageId as string
                        ) ?? undefined}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
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
                <div className="space-y-4 text-sm">
                  {(selectedConversation.adId as string) && (
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Ad ID</p>
                        <p className="text-muted-foreground text-xs font-mono">
                          {selectedConversation.adId as string}
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Customer messaged from an ad
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="text-center text-muted-foreground text-sm">
                    <p>Notes and orders coming soon</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
