'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Filter,
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
  Share2,
  Ban,
  BellOff,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Tag,
  AlertTriangle,
  ChevronRight,
  PanelLeft,
  MoreVertical,
  Archive,
  Calendar,
  Menu,
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
  updateConversationNotes,
  addConversationLabel,
  removeConversationLabel,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSearchParams, usePathname, useParams, useRouter } from 'next/navigation';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useConfig } from '@/contexts/AdAccountContext';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AdBoxSettings } from '@/components/adbox/adbox-settings';
import { InboxStatistics } from '@/components/adbox/InboxStatistics';
import { cn } from '@/lib/utils';

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

import { Suspense } from 'react';

function AdBoxContent() {
  return <AdBoxPage />;
}

export default function AdBoxPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AdBoxPage />
    </Suspense>
  );
}

function AdBoxPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'chat';
  const slug = typeof params?.slug === 'string' ? params.slug : null;
  const { notificationsEnabled, soundEnabled } = useAppSettings();
  const { selectedPages: configSelectedPages, loading: configLoading, refreshData } = useConfig();

  // Pages come from Account > Team > Pages selection
  const pages = configSelectedPages.map((p) => ({
    id: p.id,
    name: p.name,
    username: (p as { username?: string | null }).username ?? null,
    access_token: p.access_token,
    picture: p.picture,
    business_name: (p as { business_name?: string }).business_name,
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
  const [dialogPageSearchQuery, setDialogPageSearchQuery] = useState('');

  // Find page by slug (username, id, or name) – case-insensitive, for URL-driven selection
  const findPageBySlug = useCallback((slugValue: string, pagesList: typeof pages) => {
    const decoded = decodeURIComponent(slugValue).trim().toLowerCase();
    if (!decoded) return null;
    return pagesList.find(
      (p) =>
        (p.username && p.username.trim().toLowerCase() === decoded) ||
        (p.id && p.id.toLowerCase() === decoded) ||
        (p.name && p.name.trim().toLowerCase() === decoded)
    ) ?? null;
  }, []);

  // Sync selection state from URL (slug): open /inbox/King.DW16 → use that page. Single = /inbox/Username|id|name, multi = /inbox/multi_pages.
  useEffect(() => {
    if (configLoading) return;
    if (!slug || slug === 'multi_pages') {
      setSelectionMode((prev) => (prev === 'multi' ? prev : 'multi'));
      return;
    }
    const page = findPageBySlug(slug, pages);
    if (page) {
      setSelectionMode((prev) => (prev === 'single' ? prev : 'single'));
      setSelectedPageIds((prev) => (prev.length === 1 && prev[0] === page.id ? prev : [page.id]));
    }
  }, [slug, pages, configLoading, findPageBySlug]);

  // Clean URL once: don't show ?tab=chat (use path only). Ref prevents infinite loop from replace -> re-render.
  const cleanedChatUrlRef = useRef(false);
  useEffect(() => {
    if (cleanedChatUrlRef.current) return;
    if (activeTab !== 'chat' || searchParams.get('tab') !== 'chat') return;
    cleanedChatUrlRef.current = true;
    const path = pathname || '/inbox/multi_pages';
    router.replace(path);
  }, [activeTab, searchParams, pathname, router]);

  // activeTab removed, now using URL params

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
  const [showConversationList, setShowConversationList] = useState(false); // Mobile: ซ่อน conversation list เริ่มต้น
  const [isMobile, setIsMobile] = useState(false); // Track mobile state
  // Detail panel is now single view "ข้อมูลการสนทนา"
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [adDetails, setAdDetails] = useState<{
    name: string | null;
    thumbnailUrl: string | null;
    title: string | null;
    body: string | null;
  } | null>(null);
  const [loadingAdPreview, setLoadingAdPreview] = useState(false);
  const adDetailsCache = useRef<Record<string, typeof adDetails>>({});
  const adPreviewFetchedFor = useRef<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedConversationRef = useRef(selectedConversation);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const currentConversationIdRef = useRef<string | null>(null);
  const [messageCache, setMessageCache] = useState<Record<string, Record<string, unknown>[]>>({});
  const notificationSoundRef = useRef<(() => void) | null>(null);
  const shouldScrollToBottomRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const loadingMoreRef = useRef(false);


  // Details Panel Dialog States
  const [openBlockDialog, setOpenBlockDialog] = useState(false);
  const [openSearchDialog, setOpenSearchDialog] = useState(false);
  const [openMuteDialog, setOpenMuteDialog] = useState(false);
  const [openMediaDialog, setOpenMediaDialog] = useState(false);
  const [openFilesDialog, setOpenFilesDialog] = useState(false);
  const [openLinksDialog, setOpenLinksDialog] = useState(false);
  const [openReportDialog, setOpenReportDialog] = useState(false);

  const [searchInConvQuery, setSearchInConvQuery] = useState('');
  const [muteDuration, setMuteDuration] = useState('15m');
  const [reportReason, setReportReason] = useState('spam');

  // Info Tab States
  const [notes, setNotes] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [linkJustCopied, setLinkJustCopied] = useState(false);
  const [adIdJustCopied, setAdIdJustCopied] = useState(false);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
    if (selectedConversation) {
      setNotes((selectedConversation as any).notes || '');
      try {
        setLabels(JSON.parse((selectedConversation as any).labels || '[]'));
      } catch {
        setLabels([]);
      }
      setLinkJustCopied(false);
      setAdIdJustCopied(false);
    }
  }, [selectedConversation]);

  // Responsive: Track mobile state และจัดการ conversation list
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (window.innerWidth >= 768 && showConversationList) {
        setShowConversationList(false);
      }
      // บน mobile: detail panel เริ่มต้นเป็น false (จะเปิดผ่าน Sheet)
      if (mobile && showDetailPanel && window.innerWidth < 1024) {
        // ไม่ต้องทำอะไร - ให้ Sheet จัดการ
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [showConversationList, showDetailPanel]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('seenMessageIds');
      if (stored) seenMessageIds.current = new Set(JSON.parse(stored).slice(-100));
    } catch { }
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

  // When adbox mounts, ensure config is fresh (visibility refresh is in AdAccountContext for all app pages)
  useEffect(() => {
    refreshData(false);
  }, [refreshData]);

  useEffect(() => {
    if (!configLoading) {
      setHasToken(pages.length > 0);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [configLoading, pages.length]);

  // Sync adbox selection with account-selected pages: when config pages change (e.g. after
  // saving on /account), keep only valid ids. When URL has a single-page slug, use that page.
  const pageIdsStr = pages.length ? [...pages].map((p) => p.id).sort().join(',') : '';
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(() => {
    const currentPages = pagesRef.current;
    if (currentPages.length === 0) return;
    const validIds = new Set(currentPages.map((p) => p.id));
    const allIds = currentPages.map((p) => p.id);
    // If URL is a single-page link (e.g. /inbox/King.DW16), use that page and don't overwrite
    if (slug && slug !== 'multi_pages') {
      const pageFromSlug = findPageBySlug(slug, currentPages);
      if (pageFromSlug && validIds.has(pageFromSlug.id)) {
        setSelectionMode((prev) => (prev === 'single' ? prev : 'single'));
        setSelectedPageIds((prev) => (prev.length === 1 && prev[0] === pageFromSlug.id ? prev : [pageFromSlug.id]));
        return;
      }
    }
    setSelectedPageIds((prev) => {
      const filtered = prev.filter((id) => validIds.has(id));
      if (filtered.length === 0) {
        // No valid pages match saved selection - select all (or first) available pages
        return selectionMode === 'single' ? [allIds[0]] : [...allIds];
      }
      return filtered;
    });
  }, [pageIdsStr, configLoading, slug, findPageBySlug]);

  // Persist selection
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedPageIds.length > 0) {
      localStorage.setItem('adbox_selectedPageIds', JSON.stringify(selectedPageIds));
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('adbox_selectionMode', selectionMode);
    }
  }, [selectedPageIds, selectionMode]);

  // Remember current inbox path (slug) so when user goes to /inbox?tab=settings, Chat link can return to this page
  useEffect(() => {
    if (typeof window === 'undefined' || !slug) return;
    sessionStorage.setItem('inbox_last_slug', slug);
  }, [slug]);

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

  // Open conversation from URL ?conversation=id or ?c_id=id
  const conversationIdFromUrl = searchParams.get('conversation') || searchParams.get('c_id');
  useEffect(() => {
    if (!conversationIdFromUrl || conversations.length === 0) return;
    const conv = conversations.find((c) => c.id === conversationIdFromUrl);
    if (conv) setSelectedConversation(conv);
  }, [conversationIdFromUrl, conversations]);

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

  // โหลดรายละเอียดโฆษณาเมื่อมีการสนทนาที่มี adId อยู่แล้ว (จาก sync/DB)
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
      .catch(() => { });
  }, [selectedConversation?.adId]);

  // เมื่อเปิดการสนทนาที่ยังไม่มี adId: ดึง ad_id + รายละเอียดโฆษณาจาก Meta ในครั้งเดียว (ไม่ต้องซิงค์)
  useEffect(() => {
    const convId = selectedConversation?.id as string | undefined;
    const pageId = selectedConversation?.pageId as string | undefined;
    const hasAdId = !!(selectedConversation?.adId as string | undefined);
    if (!convId || !pageId) {
      setLoadingAdPreview(false);
      adPreviewFetchedFor.current = null;
      return;
    }
    if (hasAdId) {
      setLoadingAdPreview(false);
      return;
    }
    if (adPreviewFetchedFor.current === convId) {
      setLoadingAdPreview(false);
      return;
    }
    adPreviewFetchedFor.current = convId;
    setLoadingAdPreview(true);
    fetch(`/api/adbox/conversation/${encodeURIComponent(convId)}/ad-preview?pageId=${encodeURIComponent(pageId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (currentConversationIdRef.current !== convId) return;
        setLoadingAdPreview(false);
        if (data.adId && data.ad) {
          const details = {
            name: data.ad.name ?? null,
            thumbnailUrl: data.ad.thumbnailUrl ?? null,
            title: data.ad.title ?? null,
            body: data.ad.body ?? null,
          };
          adDetailsCache.current[data.adId] = details;
          setAdDetails(details);
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, adId: data.adId } : c))
          );
          setSelectedConversation((s) =>
            s?.id === convId ? { ...s, adId: data.adId } : s
          );
        }
      })
      .catch(() => {
        if (currentConversationIdRef.current === convId) setLoadingAdPreview(false);
        adPreviewFetchedFor.current = null;
      });
  }, [selectedConversation?.id, selectedConversation?.pageId, selectedConversation?.adId]);

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
      } catch { }
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
      } catch { }
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
        // Use pagesRef.current to avoid stale closure
        const currentPages = pagesRef.current;
        const selectedPages = currentPages.filter((p) => pageIds.includes(p.id));
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
    } catch { }

    if (forceSync) {
      const syncTask = async () => {
        try {
          const page = pagesRef.current.find((p) => p.id === pageId);
          await syncMessagesOnce(conversationId, pageId, page?.access_token);
          if (currentConversationIdRef.current !== conversationId) return;
          const updated = await fetchMessagesFromDB(conversationId);
          if (updated.length > 0) {
            setMessages(updated);
            setMessageCache((prev) => ({ ...prev, [conversationId]: updated }));
            lastMessageCountRef.current = updated.length;
          }
        } catch { }
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
        selectedConversation.id as string,
        getPageDetails(selectedConversation.pageId as string)?.access_token
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
      setDialogPageSearchQuery('');
    }
  };

  const filteredDialogPages = dialogPageSearchQuery.trim()
    ? pages.filter((p) =>
      p.name.toLowerCase().includes(dialogPageSearchQuery.toLowerCase()) ||
      (p.username && p.username.toLowerCase().includes(dialogPageSearchQuery.toLowerCase())) ||
      (p.business_name && p.business_name.toLowerCase().includes(dialogPageSearchQuery.toLowerCase())) ||
      p.id.includes(dialogPageSearchQuery)
    )
    : pages;

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
    // Update URL to match selection: /inbox/Username or /inbox/pageId (single), or /inbox/multi_pages (multi)
    if (tempSelectionMode === 'multi') {
      router.replace('/inbox/multi_pages');
    } else if (ids.length === 1) {
      const page = pages.find((p) => p.id === ids[0]);
      if (page) {
        const slugValue = page.username || page.id;
        router.replace(`/inbox/${encodeURIComponent(slugValue)}`);
      } else {
        router.replace('/inbox/multi_pages');
      }
    } else {
      router.replace('/inbox/multi_pages');
    }
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

  // Helper to handle transparent pixel (Facebook API permission error)
  const handleAvatarImageLoad = (e: React.SyntheticEvent<HTMLImageElement>, pictureUrl: string | null, fallbackUrl: string) => {
    const img = e.target as HTMLImageElement;
    // Check if image is transparent 1x1 pixel (Facebook API permission error)
    // Transparent PNG is 1x1 pixel, so if naturalWidth/naturalHeight is 1, use fallback
    if (img.naturalWidth === 1 && img.naturalHeight === 1 && pictureUrl && pictureUrl.includes('/api/adbox/participant-picture')) {
      console.debug('[adbox] Detected transparent pixel (permission error), using fallback avatar');
      img.src = fallbackUrl;
      return;
    }
  };

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col">
      {activeTab === 'chat' && (
        <div className="flex-1 overflow-hidden mt-0 flex flex-col">
          <div className="h-full flex flex-col px-0 pt-0 pb-0">
            {toastMessage && (
              <div className="fixed top-2 right-2 md:top-4 md:right-4 z-50 bg-primary text-primary-foreground px-3 py-2 md:px-4 md:py-3 rounded-lg shadow-lg flex items-center gap-2 md:gap-3 max-w-[calc(100vw-1rem)] md:max-w-sm animate-in slide-in-from-top-2">
                <Bell className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                <div className="flex-1 truncate text-xs md:text-sm">{toastMessage}</div>
                <button onClick={() => setToastMessage(null)} className="opacity-80 hover:opacity-100 shrink-0">
                  ✕
                </button>
              </div>
            )}

            {/* Unconnected/No Pages Alert */}
            {(!hasToken && !configLoading) && (
              <div className="mb-3 md:mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                  <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-800/30 rounded-full shrink-0">
                    <MessageCircle className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs md:text-sm font-semibold text-blue-900 dark:text-blue-300">
                      {pages.length === 0 ? t('adbox.selectPages') : t('adbox.connectFacebook')}
                    </h3>
                    <p className="text-xs md:text-sm text-blue-700 dark:text-blue-400">
                      {pages.length === 0 ? (
                        <>
                          Select pages in{' '}
                          <Link href="/settings?tab=team" className="underline hover:text-blue-900 dark:hover:text-blue-200 font-medium">
                            Account &gt; Team
                          </Link>{' '}
                          to manage conversations.
                        </>
                      ) : (
                        t('adbox.connectDescription')
                      )}
                    </p>
                  </div>
                </div>
                <Link href="/settings?tab=team" className="w-full sm:w-auto">
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 w-full sm:w-auto text-xs md:text-sm"
                  >
                    Go to Settings
                  </Button>
                </Link>
              </div>
            )}

            <div className="flex-1 flex flex-row overflow-hidden min-h-0 relative">
              {/* Mobile overlay backdrop */}
              {showConversationList && (
                <div
                  className="fixed inset-0 bg-black/50 z-40 md:hidden"
                  onClick={() => setShowConversationList(false)}
                />
              )}
              {/* Conversation List */}
              <div
                className={cn(
                  'absolute md:relative z-50 md:z-auto w-full max-w-[380px] md:max-w-[380px] h-full flex-shrink-0 flex flex-col overflow-hidden transition-transform duration-300 border-r border-border',
                  showConversationList ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                )}
              >
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden h-8 w-8"
                      onClick={() => setShowConversationList(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">{t('adbox.chat')}</span>
                  </div>
                  <div className="flex gap-1">
                    <Dialog open={isDialogOpen} onOpenChange={handleOpenSelectDialog}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Select pages">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] min-h-[680px] flex flex-col bg-white dark:bg-white">
                        <DialogHeader>
                          <DialogTitle>{t('adbox.selectPages')}</DialogTitle>
                          <DialogDescription>
                            Choose Single page or Multi pages. Pages are from Settings.
                          </DialogDescription>
                        </DialogHeader>

                        {/* Tab switcher: Single page / Multi-pages — ฝั่งขวา: ปุ่มตั้งค่าไป /account */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex rounded-lg border border-input bg-muted/30 p-1 flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => {
                                setTempSelectionMode('single');
                                if (tempSelectedPageIds.length > 1) setTempSelectedPageIds([tempSelectedPageIds[0]]);
                              }}
                              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tempSelectionMode === 'single' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                              Single page
                            </button>
                            <button
                              type="button"
                              onClick={() => setTempSelectionMode('multi')}
                              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tempSelectionMode === 'multi' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                              Multi-pages
                            </button>
                          </div>
                          <Link href="/settings?tab=subscription" className="shrink-0" title={t('adbox.manageInSettings', 'Manage in Settings')}>
                            <Button variant="outline" size="icon">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>

                        {/* Search bar + Select All */}
                        <div className="flex items-center gap-2">
                          {tempSelectionMode === 'multi' && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Checkbox
                                id="dialog-select-all"
                                checked={pages.length > 0 && tempSelectedPageIds.length === pages.length}
                                onCheckedChange={() => toggleTempSelectAll()}
                              />
                              <Label htmlFor="dialog-select-all" className="text-sm cursor-pointer whitespace-nowrap">
                                {tempSelectedPageIds.length === pages.length ? t('adbox.deselectAll') : t('adbox.selectAll')}
                              </Label>
                            </div>
                          )}
                          <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                              placeholder={t('adbox.searchPage')}
                              className="pl-9 h-9"
                              value={dialogPageSearchQuery}
                              onChange={(e) => setDialogPageSearchQuery(e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            className="flex-shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            aria-label="Filter"
                          >
                            <Filter className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Grid of selectable page cards — เลื่อนด้วยสกอร์เมาส์ สกอร์บาร์เล็กบางใส ไม่มีหัวลูกศร */}
                        <div className="max-h-[50vh] min-h-[240px] overflow-y-auto overflow-x-hidden border rounded-lg scrollbar-thin-clear">
                          <div className="p-2">
                            {pages.length === 0 ? (
                              <div className="text-center py-12 text-muted-foreground text-sm">
                                No pages. Go to Settings to select pages.
                              </div>
                            ) : filteredDialogPages.length === 0 ? (
                              <div className="text-center py-12 text-muted-foreground text-sm">
                                No pages match your search.
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {filteredDialogPages.map((page) => {
                                  const isSelected = tempSelectedPageIds.includes(page.id);
                                  const pictureUrl = (page.picture as { data?: { url?: string } })?.data?.url;
                                  return (
                                    <button
                                      key={page.id}
                                      type="button"
                                      onClick={() => toggleTempPage(page.id)}
                                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${isSelected ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20' : 'hover:bg-muted/50 border-border'}`}
                                    >
                                      <Avatar className="h-10 w-10 shrink-0">
                                        <AvatarImage src={pictureUrl} />
                                        <AvatarFallback className="text-sm">{page.name.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1 space-y-0.5">
                                        <p className="font-medium text-sm truncate">{page.name}</p>
                                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-[#1877F2] text-white" aria-hidden>
                                            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor">
                                              <path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.61l.53-4z" />
                                            </svg>
                                          </span>
                                          {page.username ? (
                                            <span title={page.username}>{page.username}</span>
                                          ) : (
                                            <span className="text-muted-foreground/80">{t('adbox.noUsername')}</span>
                                          )}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {page.id}
                                        </p>
                                      </div>
                                      <div className="shrink-0 mt-1 h-4 w-4 flex items-center justify-center">
                                        {isSelected && (
                                          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-xs text-muted-foreground">
                            {tempSelectedPageIds.length} of {pages.length} selected
                          </span>
                          <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                              {t('adbox.cancel')}
                            </Button>
                            <Button onClick={handleSavePageSelection} disabled={tempSelectedPageIds.length === 0}>
                              {t('adbox.applyChanges')}
                            </Button>
                          </DialogFooter>
                        </div>
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
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder={t('adbox.search')}
                        className="pl-9 h-8 md:h-9 text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="flex-shrink-0 h-8 md:h-9 w-8 md:w-9 inline-flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      aria-label="Filter"
                    >
                      <Filter className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {(['all', 'unread', 'read'] as const).map((f) => (
                      <Button
                        key={f}
                        variant={filterStatus === f ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 h-7 md:h-8 text-xs md:text-[13px]"
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
                      // Show real picture if participant ID and page ID are available
                      const participantId = participant?.id;
                      const pageId = conv.pageId as string | undefined;
                      const pictureUrl = (participantId && pageId) ? getParticipantPictureUrl(participantId, pageId) : null;

                      // Debug: Log when participantId or pageId is missing
                      if (!participantId || !pageId) {
                        console.warn('[adbox] Missing data for picture:', {
                          participantId,
                          pageId,
                          participantName: participant?.name,
                          convId: conv.id,
                          conversation: conv
                        });
                      } else {
                        console.debug('[adbox] Picture URL generated:', {
                          pictureUrl,
                          participantId,
                          pageId,
                          participantName: participant?.name
                        });
                      }

                      return (
                        <div
                          key={conv.id as string}
                          className={`grid grid-cols-[auto_1fr_auto] gap-2 md:gap-3 p-2 md:p-3 cursor-pointer border-l-2 transition-colors ${isSelected ? 'bg-primary/10 border-l-primary' : isUnread ? 'hover:bg-muted' : 'hover:bg-muted'
                            }`}
                          onClick={() => {
                            setSelectedConversation(conv);
                            setConversations((prev) =>
                              prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
                            );
                            if (unreadCount > 0) markConversationAsRead(conv.id as string);
                            updateConversationViewer(conv.id as string);
                            // Mobile: ปิด conversation list เมื่อเลือกแชท
                            if (window.innerWidth < 768) {
                              setShowConversationList(false);
                            }
                          }}
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10 md:h-12 md:w-12 shrink-0">
                              <AvatarImage
                                src={pictureUrl || fallbackUrl}
                                alt={participant?.name || 'User'}
                                onError={(e) => {
                                  const el = e.target as HTMLImageElement;
                                  console.warn('[adbox] Avatar image failed to load:', {
                                    pictureUrl,
                                    participantId,
                                    pageId,
                                    errorSrc: el.src,
                                    currentSrc: el.currentSrc
                                  });
                                  // Only set fallback if current src is not already the fallback
                                  if (el.src !== fallbackUrl && el.currentSrc !== fallbackUrl) {
                                    el.src = fallbackUrl;
                                  }
                                }}
                                onLoad={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  // Check if image is transparent 1x1 pixel (Facebook API permission error)
                                  // Transparent PNG is 1x1 pixel, so if naturalWidth/naturalHeight is 1, use fallback
                                  if (img.naturalWidth === 1 && img.naturalHeight === 1 && pictureUrl && pictureUrl.includes('/api/adbox/participant-picture')) {
                                    console.debug('[adbox] Detected transparent pixel (permission error), using fallback avatar');
                                    img.src = fallbackUrl;
                                    return;
                                  }
                                  if (pictureUrl && pictureUrl !== fallbackUrl) {
                                    console.debug('[adbox] Avatar image loaded successfully:', { pictureUrl, participantId, pageId });
                                  }
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
                          <div className="min-w-0 flex flex-col justify-center gap-0.5 md:gap-1">
                            <span
                              className={`text-xs md:text-sm truncate ${isUnread ? 'font-semibold' : 'font-medium'}`}
                            >
                              {participant?.name || 'Facebook User'}
                            </span>
                            <span className={`text-[10px] md:text-xs truncate ${isUnread ? 'font-medium' : 'text-muted-foreground'}`}>
                              {(conv.snippet as string) || 'No message'}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] md:text-xs whitespace-nowrap shrink-0 ${isUnread ? 'text-primary font-medium' : 'text-muted-foreground'}`}
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
                    <div className="px-3 md:px-4 py-2 md:py-3 border-b flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                        {/* Mobile: Hamburger menu to show conversation list */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="md:hidden h-8 w-8 shrink-0"
                          onClick={() => setShowConversationList(true)}
                        >
                          <Menu className="h-4 w-4" />
                        </Button>
                        <Avatar className="h-8 w-8 md:h-10 md:w-10 shrink-0">
                          <AvatarImage
                            src={getParticipantPictureUrl(
                              (selectedConversation.participants as { data?: { id?: string }[] })?.data?.[0]?.id,
                              selectedConversation.pageId as string
                            ) || getFallbackAvatar(
                              (selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]
                                ?.name || 'U'
                            )}
                            onLoad={(e) => {
                              const fallback = getFallbackAvatar(
                                (selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]
                                  ?.name || 'U'
                              );
                              handleAvatarImageLoad(e, getParticipantPictureUrl(
                                (selectedConversation.participants as { data?: { id?: string }[] })?.data?.[0]?.id,
                                selectedConversation.pageId as string
                              ), fallback);
                            }}
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
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="font-semibold text-sm truncate">
                            {(selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]
                              ?.name || 'Unknown'}
                          </span>
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              title={t('adbox.copyConversationLink', 'Copy conversation link')}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent w-fit"
                              onClick={() => {
                                const base = typeof window !== 'undefined' ? window.location.origin : '';
                                const pageId = selectedConversation.pageId as string;
                                const page = pages.find((p) => p.id === pageId);
                                const slug = page?.username || page?.id || pageId;
                                const link = `${base}/inbox/${encodeURIComponent(slug)}?c_id=${encodeURIComponent(selectedConversation.id as string)}`;
                                navigator.clipboard.writeText(link);
                                setLinkJustCopied(true);
                                setToastMessage(t('adbox.linkCopied', 'Link copied'));
                                setTimeout(() => { setLinkJustCopied(false); setToastMessage(null); }, 2000);
                              }}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </button>
                            {linkJustCopied && (
                              <span className="text-[11px] text-primary font-medium animate-in fade-in">คัดลอกแล้ว</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Mark unread"
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
                          <span className="relative inline-flex">
                            <Mail className="h-4 w-4" />
                            <span className="absolute top-0 -right-0.5 h-2 w-2 rounded-full bg-destructive" aria-hidden />
                          </span>
                        </Button>
                        {/* Desktop: Toggle detail panel */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hidden lg:flex h-8 w-8 shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-primary transition-colors"
                          onClick={() => setShowDetailPanel((v) => !v)}
                          title={showDetailPanel ? 'ซ่อนข้อมูลการสนทนา' : 'แสดงข้อมูลการสนทนา'}
                        >
                          <PanelLeft className={cn('h-5 w-5 transition-transform', !showDetailPanel && 'rotate-180')} />
                        </Button>
                        {/* Mobile/Tablet: Open detail panel in Sheet */}
                        <Sheet open={showDetailPanel && isMobile} onOpenChange={(open) => {
                          setShowDetailPanel(open);
                        }}>
                          <SheetTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="lg:hidden h-8 w-8 shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-primary transition-colors"
                              title="แสดงข้อมูลการสนทนา"
                            >
                              <PanelLeft className="h-5 w-5" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="right" className="w-[90vw] sm:w-[380px] p-0 flex flex-col">
                            <SheetHeader className="px-4 py-3 border-b">
                              <SheetTitle>ข้อมูลการสนทนา</SheetTitle>
                            </SheetHeader>
                            <div className="flex-1 overflow-y-auto">
                              {/* Copy detail panel content here for mobile */}
                              {selectedConversation && (
                                <div className="flex flex-col h-full">
                                  {/* Profile Section */}
                                  <div className="flex flex-col items-center pt-4 pb-4 border-b">
                                    <Avatar className="h-16 w-16 mb-2">
                                      <AvatarImage
                                        src={getParticipantPictureUrl(
                                          (selectedConversation.participants as { data?: { id?: string }[] })?.data?.[0]?.id,
                                          selectedConversation.pageId as string
                                        ) ?? undefined}
                                        onLoad={(e) => {
                                          const pictureUrl = getParticipantPictureUrl(
                                            (selectedConversation.participants as { data?: { id?: string }[] })?.data?.[0]?.id,
                                            selectedConversation.pageId as string
                                          );
                                          const fallback = getFallbackAvatar(
                                            (selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]?.name || 'U'
                                          );
                                          handleAvatarImageLoad(e, pictureUrl, fallback);
                                        }}
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
                                    <h4 className="font-semibold text-base">
                                      {(selectedConversation.participants as { data?: { name?: string }[] })
                                        ?.data?.[0]
                                        ?.name || 'Unknown'}
                                    </h4>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-center gap-4 mt-3">
                                      <div className="flex flex-col items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted"
                                          onClick={() => window.open(selectedConversation.facebookLink as string, '_blank')}
                                          disabled={!selectedConversation.facebookLink}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                        <span className="text-[10px] text-muted-foreground">ดูบน Facebook</span>
                                      </div>
                                      <div className="flex flex-col items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted"
                                          onClick={() => setOpenBlockDialog(true)}
                                        >
                                          <Ban className="h-4 w-4" />
                                        </Button>
                                        <span className="text-[10px] text-muted-foreground">บล็อก</span>
                                      </div>
                                      <div className="flex flex-col items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted"
                                          onClick={() => setOpenSearchDialog(true)}
                                        >
                                          <Search className="h-4 w-4" />
                                        </Button>
                                        <span className="text-[10px] text-muted-foreground">ค้นหาข้อความ</span>
                                      </div>
                                      <div className="flex flex-col items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted"
                                          onClick={() => {
                                            setToastMessage('ปิดกลุ่มสนทนาแล้ว');
                                            setTimeout(() => setToastMessage(null), 2000);
                                          }}
                                        >
                                          <Archive className="h-4 w-4" />
                                        </Button>
                                        <span className="text-[10px] text-muted-foreground">ปิดกลุ่มสนทนา</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Menu Items */}
                                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                                      onClick={() => setOpenMuteDialog(true)}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Bell className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        <span className="text-sm font-medium">การแจ้งเตือนการสนทนา</span>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                                      onClick={() => setOpenMediaDialog(true)}
                                    >
                                      <div className="flex items-center gap-3">
                                        <ImageIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        <span className="text-sm font-medium">ไฟล์รูปภาพ/วิดีโอ</span>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                                      onClick={() => setOpenFilesDialog(true)}
                                    >
                                      <div className="flex items-center gap-3">
                                        <FileText className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        <span className="text-sm font-medium">ไฟล์</span>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                                      onClick={() => setOpenLinksDialog(true)}
                                    >
                                      <div className="flex items-center gap-3">
                                        <LinkIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        <span className="text-sm font-medium">ลิงค์</span>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                                      onClick={() => {
                                        setToastMessage('ฟีเจอร์เลือกวันเกิดจะเปิดให้ใช้งานเร็วๆ นี้');
                                        setTimeout(() => setToastMessage(null), 2000);
                                      }}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Calendar className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        <span className="text-sm font-medium">เลือกวันเกิด</span>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                    </Button>

                                    {/* Labels Section */}
                                    <div className="pt-3 mt-1 border-t">
                                      <div className="flex items-center gap-2 px-3 mb-2">
                                        <Tag className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">ป้ายกำกับ</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5 px-3">
                                        {labels.map((label, index) => (
                                          <div key={index} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                            {label}
                                            <button
                                              onClick={async () => {
                                                const newLabels = labels.filter((_, i) => i !== index);
                                                setLabels(newLabels);
                                                await removeConversationLabel(selectedConversation?.id as string, label);
                                              }}
                                              className="hover:text-primary/70"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        ))}
                                        <div className="flex items-center gap-1">
                                          <Input
                                            value={newLabel}
                                            onChange={(e) => setNewLabel(e.target.value)}
                                            onKeyDown={async (e) => {
                                              if (e.key === 'Enter' && newLabel.trim()) {
                                                if (!labels.includes(newLabel.trim())) {
                                                  const updatedLabels = [...labels, newLabel.trim()];
                                                  setLabels(updatedLabels);
                                                  await addConversationLabel(selectedConversation?.id as string, newLabel.trim());
                                                  setNewLabel('');
                                                }
                                              }
                                            }}
                                            placeholder="เพิ่มป้ายกำกับ..."
                                            className="h-6 w-24 text-xs px-2 py-0"
                                          />
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={async () => {
                                              if (newLabel.trim()) {
                                                if (!labels.includes(newLabel.trim())) {
                                                  const updatedLabels = [...labels, newLabel.trim()];
                                                  setLabels(updatedLabels);
                                                  await addConversationLabel(selectedConversation?.id as string, newLabel.trim());
                                                  setNewLabel('');
                                                }
                                              }
                                            }}
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Notes Section */}
                                    <div className="pt-3 mt-1 border-t">
                                      <div className="flex items-center gap-2 px-3 mb-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">โน้ต</span>
                                      </div>
                                      <div className="px-3">
                                        <textarea
                                          className="w-full min-h-[80px] p-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-background resize-none"
                                          placeholder="เพิ่มบันทึก..."
                                          value={notes}
                                          onChange={(e) => setNotes(e.target.value)}
                                          onBlur={async () => {
                                            await updateConversationNotes(selectedConversation?.id as string, notes);
                                            setToastMessage('บันทึกแล้ว');
                                            setTimeout(() => setToastMessage(null), 2000);
                                          }}
                                        />
                                      </div>
                                    </div>

                                    {/* Report */}
                                    <div className="pt-2 mt-1 border-t">
                                      <Button
                                        variant="ghost"
                                        className="w-full justify-start h-auto py-3 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg gap-3"
                                        onClick={() => setOpenReportDialog(true)}
                                      >
                                        <AlertTriangle className="h-5 w-5" />
                                        <span className="text-sm font-medium">รายงานว่าเป็นสแปม</span>
                                      </Button>
                                    </div>

                                    {/* Ad ID – คลิกเพื่อคัดลอก */}
                                    {(selectedConversation.adId as string) && (
                                      <div className="pt-2 mt-1 border-t px-3 pb-2 flex flex-col gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(selectedConversation.adId as string);
                                            setAdIdJustCopied(true);
                                            setToastMessage('คัดลอก Ad ID แล้ว');
                                            setTimeout(() => { setAdIdJustCopied(false); setToastMessage(null); }, 2000);
                                          }}
                                          className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors cursor-pointer font-mono text-left"
                                          title="คลิกเพื่อคัดลอก"
                                        >
                                          adid:{selectedConversation.adId as string}
                                        </button>
                                        {adIdJustCopied && (
                                          <span className="text-[11px] text-primary font-medium animate-in fade-in">คัดลอกแล้ว</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </SheetContent>
                        </Sheet>
                      </div>
                    </div>

                    <div
                      className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-[#e5ded8] dark:bg-[hsl(28,12%,18%)]"
                      ref={scrollRef}
                      style={{ minHeight: 0 }}
                    >
                      {/* ตัวอย่างโพสโฆษณา – อยู่ในช่องแชท ฝั่งขวา */}
                      {(selectedConversation.adId as string) && adDetails && (
                        <div className="mb-4 flex flex-col items-end gap-1">
                          <div className="w-32 h-32 md:w-40 md:h-40 rounded-lg border border-primary/20 bg-card overflow-hidden shadow-sm flex-shrink-0">
                            {adDetails.thumbnailUrl ? (
                              <img
                                src={adDetails.thumbnailUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <Megaphone className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          {adDetails.body && (
                            <p className="text-xs text-muted-foreground line-clamp-2 break-words max-w-[160px] md:max-w-[200px] text-right">
                              {adDetails.body}
                            </p>
                          )}
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
                            } catch { }
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
                                className={`group flex items-start gap-1.5 md:gap-2 ${isFromUs ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`flex max-w-[90%] sm:max-w-[85%] items-end gap-1.5 md:gap-2 ${isFromUs ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                  <div
                                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm ${isFromUs
                                      ? 'bg-primary text-primary-foreground rounded-br-none'
                                      : 'bg-card text-card-foreground rounded-bl-none border border-primary/30 shadow-sm'
                                      }`}
                                  >
                                    {stickerUrl ? (
                                      <img
                                        src={stickerUrl}
                                        alt="Sticker"
                                        className="max-w-[100px] max-h-[100px] md:max-w-[120px] md:max-h-[120px] object-contain"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : imageAtts.length > 0 ? (
                                      <div className="space-y-1.5 md:space-y-2">
                                        {imageAtts.map((att, i) => (
                                          <img
                                            key={i}
                                            src={att.url}
                                            alt=""
                                            className="max-w-full max-h-[200px] md:max-h-[240px] rounded-lg object-contain"
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
                                      className="text-[10px] md:text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shrink-0"
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

                    <div className="p-3 md:p-4 border-t">
                      <div className="flex items-end gap-2">
                        <div className="flex-1 relative">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={t('adbox.typeMessage')}
                            className="min-h-[44px] max-h-[120px] py-2 md:py-3 pr-12 resize-none rounded-lg text-sm md:text-base"
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
                          className="h-10 w-10 md:h-11 md:w-11 rounded-lg shrink-0"
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
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 p-4">
                    {/* Mobile: แสดงปุ่มเปิด conversation list */}
                    <Button
                      variant="outline"
                      className="md:hidden mb-4"
                      onClick={() => setShowConversationList(true)}
                    >
                      <Menu className="h-4 w-4 mr-2" />
                      เปิดรายการแชท
                    </Button>
                    <MessageCircle className="h-12 w-12 mb-4 text-primary/50" />
                    <h3 className="text-base md:text-lg font-medium text-foreground mb-1">
                      {t('adbox.selectConversation')}
                    </h3>
                    <p className="text-xs md:text-sm text-center max-w-xs">
                      Select a chat from the list to start a conversation
                    </p>
                  </div>
                )}
              </div>

              {/* Detail Panel - ซ่อนบน mobile, แสดงเป็น drawer บน tablet+ */}
              {selectedConversation && showDetailPanel && (
                <div className="hidden lg:flex w-[380px] flex-shrink-0 flex flex-col overflow-hidden border-l border-border">
                  <div className="flex items-center px-4 py-3 border-b">
                    <span className="text-sm font-semibold">ข้อมูลการสนทนา</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col h-full">
                      {/* Profile Section */}
                      <div className="flex flex-col items-center pt-4 pb-4 border-b">
                        <Avatar className="h-16 w-16 mb-2">
                          <AvatarImage
                            src={getParticipantPictureUrl(
                              (selectedConversation.participants as { data?: { id?: string }[] })?.data?.[0]?.id,
                              selectedConversation.pageId as string
                            ) ?? undefined}
                            onLoad={(e) => {
                              const pictureUrl = getParticipantPictureUrl(
                                (selectedConversation.participants as { data?: { id?: string }[] })?.data?.[0]?.id,
                                selectedConversation.pageId as string
                              );
                              const fallback = getFallbackAvatar(
                                (selectedConversation.participants as { data?: { name?: string }[] })?.data?.[0]?.name || 'U'
                              );
                              handleAvatarImageLoad(e, pictureUrl, fallback);
                            }}
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
                        <h4 className="font-semibold text-base">
                          {(selectedConversation.participants as { data?: { name?: string }[] })
                            ?.data?.[0]
                            ?.name || 'Unknown'}
                        </h4>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-center gap-4 mt-3">
                          <div className="flex flex-col items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted"
                              onClick={() => window.open(selectedConversation.facebookLink as string, '_blank')}
                              disabled={!selectedConversation.facebookLink}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <span className="text-[10px] text-muted-foreground">ดูบน Facebook</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted"
                              onClick={() => setOpenBlockDialog(true)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                            <span className="text-[10px] text-muted-foreground">บล็อก</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted"
                              onClick={() => setOpenSearchDialog(true)}
                            >
                              <Search className="h-4 w-4" />
                            </Button>
                            <span className="text-[10px] text-muted-foreground">ค้นหาข้อความ</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted"
                              onClick={() => {
                                setToastMessage('ปิดกลุ่มสนทนาแล้ว');
                                setTimeout(() => setToastMessage(null), 2000);
                              }}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <span className="text-[10px] text-muted-foreground">ปิดกลุ่มสนทนา</span>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        <Button
                          variant="ghost"
                          className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                          onClick={() => setOpenMuteDialog(true)}
                        >
                          <div className="flex items-center gap-3">
                            <Bell className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            <span className="text-sm font-medium">การแจ้งเตือนการสนทนา</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </Button>

                        <Button
                          variant="ghost"
                          className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                          onClick={() => setOpenMediaDialog(true)}
                        >
                          <div className="flex items-center gap-3">
                            <ImageIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            <span className="text-sm font-medium">ไฟล์รูปภาพ/วิดีโอ</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </Button>

                        <Button
                          variant="ghost"
                          className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                          onClick={() => setOpenFilesDialog(true)}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            <span className="text-sm font-medium">ไฟล์</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </Button>

                        <Button
                          variant="ghost"
                          className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                          onClick={() => setOpenLinksDialog(true)}
                        >
                          <div className="flex items-center gap-3">
                            <LinkIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            <span className="text-sm font-medium">ลิงค์</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </Button>

                        <Button
                          variant="ghost"
                          className="w-full justify-between h-auto py-3 px-3 hover:bg-muted/50 rounded-lg group"
                          onClick={() => {
                            setToastMessage('ฟีเจอร์เลือกวันเกิดจะเปิดให้ใช้งานเร็วๆ นี้');
                            setTimeout(() => setToastMessage(null), 2000);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            <span className="text-sm font-medium">เลือกวันเกิด</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </Button>

                        {/* Labels Section */}
                        <div className="pt-3 mt-1 border-t">
                          <div className="flex items-center gap-2 px-3 mb-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">ป้ายกำกับ</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 px-3">
                            {labels.map((label, index) => (
                              <div key={index} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                {label}
                                <button
                                  onClick={async () => {
                                    const newLabels = labels.filter((_, i) => i !== index);
                                    setLabels(newLabels);
                                    await removeConversationLabel(selectedConversation?.id as string, label);
                                  }}
                                  className="hover:text-primary/70"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <div className="flex items-center gap-1">
                              <Input
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && newLabel.trim()) {
                                    if (!labels.includes(newLabel.trim())) {
                                      const updatedLabels = [...labels, newLabel.trim()];
                                      setLabels(updatedLabels);
                                      await addConversationLabel(selectedConversation?.id as string, newLabel.trim());
                                      setNewLabel('');
                                    }
                                  }
                                }}
                                placeholder="เพิ่มป้ายกำกับ..."
                                className="h-6 w-24 text-xs px-2 py-0"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={async () => {
                                  if (newLabel.trim()) {
                                    if (!labels.includes(newLabel.trim())) {
                                      const updatedLabels = [...labels, newLabel.trim()];
                                      setLabels(updatedLabels);
                                      await addConversationLabel(selectedConversation?.id as string, newLabel.trim());
                                      setNewLabel('');
                                    }
                                  }
                                }}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Notes Section */}
                        <div className="pt-3 mt-1 border-t">
                          <div className="flex items-center gap-2 px-3 mb-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">โน้ต</span>
                          </div>
                          <div className="px-3">
                            <textarea
                              className="w-full min-h-[80px] p-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-background resize-none"
                              placeholder="เพิ่มบันทึก..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              onBlur={async () => {
                                await updateConversationNotes(selectedConversation?.id as string, notes);
                                setToastMessage('บันทึกแล้ว');
                                setTimeout(() => setToastMessage(null), 2000);
                              }}
                            />
                          </div>
                        </div>

                        {/* Report */}
                        <div className="pt-2 mt-1 border-t">
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-auto py-3 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg gap-3"
                            onClick={() => setOpenReportDialog(true)}
                          >
                            <AlertTriangle className="h-5 w-5" />
                            <span className="text-sm font-medium">รายงานว่าเป็นสแปม</span>
                          </Button>
                        </div>

                        {/* Ad ID – คลิกเพื่อคัดลอก */}
                        {(selectedConversation.adId as string) && (
                          <div className="pt-2 mt-1 border-t px-3 pb-2 flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedConversation.adId as string);
                                setAdIdJustCopied(true);
                                setToastMessage('คัดลอก Ad ID แล้ว');
                                setTimeout(() => { setAdIdJustCopied(false); setToastMessage(null); }, 2000);
                              }}
                              className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors cursor-pointer font-mono text-left"
                              title="คลิกเพื่อคัดลอก"
                            >
                              adid:{selectedConversation.adId as string}
                            </button>
                            {adIdJustCopied && (
                              <span className="text-[11px] text-primary font-medium animate-in fade-in">คัดลอกแล้ว</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Block Dialog */}
            <Dialog open={openBlockDialog} onOpenChange={setOpenBlockDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Block User?</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to block {(selectedConversation?.participants as { data?: { name?: string }[] })?.data?.[0]?.name || 'this user'}?
                    They will not be able to message you.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenBlockDialog(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setOpenBlockDialog(false);
                      setToastMessage('User blocked successfully');
                      setTimeout(() => setToastMessage(null), 3000);
                    }}
                  >
                    Block
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Mute Dialog */}
            <Dialog open={openMuteDialog} onOpenChange={setOpenMuteDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mute Notifications</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <RadioGroup value={muteDuration} onValueChange={setMuteDuration}>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="15m" id="r1" />
                      <Label htmlFor="r1">For 15 minutes</Label>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="1h" id="r2" />
                      <Label htmlFor="r2">For 1 hour</Label>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="8h" id="r3" />
                      <Label htmlFor="r3">For 8 hours</Label>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="24h" id="r4" />
                      <Label htmlFor="r4">For 24 hours</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="until_changed" id="r5" />
                      <Label htmlFor="r5">Until I change it</Label>
                    </div>
                  </RadioGroup>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenMuteDialog(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      setOpenMuteDialog(false);
                      setToastMessage(`Notifications muted for ${muteDuration}`);
                      setTimeout(() => setToastMessage(null), 3000);
                    }}
                  >
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Report Dialog */}
            <Dialog open={openReportDialog} onOpenChange={setOpenReportDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report Conversation</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <RadioGroup value={reportReason} onValueChange={setReportReason}>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="spam" id="rep1" />
                      <Label htmlFor="rep1">Spam or Scam</Label>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="harassment" id="rep2" />
                      <Label htmlFor="rep2">Harassment</Label>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <RadioGroupItem value="inappropriate" id="rep3" />
                      <Label htmlFor="rep3">Inappropriate Content</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id="rep4" />
                      <Label htmlFor="rep4">Other</Label>
                    </div>
                  </RadioGroup>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenReportDialog(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setOpenReportDialog(false);
                      setToastMessage('Report submitted. Thank you for your feedback.');
                      setTimeout(() => setToastMessage(null), 3000);
                    }}
                  >
                    Report
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Search in Conversation Dialog */}
            <Dialog open={openSearchDialog} onOpenChange={setOpenSearchDialog}>
              <DialogContent className="max-w-md h-[400px] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Search in Conversation</DialogTitle>
                </DialogHeader>
                <div className="flex items-center border rounded-md px-3 mt-2">
                  <Search className="h-4 w-4 text-muted-foreground mr-2" />
                  <Input
                    className="border-0 focus-visible:ring-0 px-0"
                    placeholder="Search messages..."
                    value={searchInConvQuery}
                    onChange={(e) => setSearchInConvQuery(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto mt-4 space-y-2">
                  {searchInConvQuery ? (
                    messages
                      .filter((m) =>
                        (m.message as string)?.toLowerCase().includes(searchInConvQuery.toLowerCase())
                      )
                      .map((m) => {
                        const timeStr = new Date(m.created_time as string).toLocaleString();
                        const isFromMe = (m.from as { id?: string })?.id === selectedConversation?.pageId;
                        return (
                          <div key={m.id as string} className="p-2 border rounded hover:bg-muted/50 text-sm">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{isFromMe ? 'You' : (m.from as { name?: string })?.name}</span>
                              <span>{timeStr}</span>
                            </div>
                            <div className="line-clamp-2">{m.message as string}</div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      Type to search messages
                    </div>
                  )}
                  {searchInConvQuery && messages.filter((m) => (m.message as string)?.toLowerCase().includes(searchInConvQuery.toLowerCase())).length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      No matches found
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Media Dialog */}
            <Dialog open={openMediaDialog} onOpenChange={setOpenMediaDialog}>
              <DialogContent className="max-w-3xl h-[600px] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Media & Photos</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto mt-2">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {messages.flatMap((m) => {
                      let attachments: { type?: string; url?: string }[] = [];
                      try {
                        if (m.attachments && typeof m.attachments === 'string') {
                          attachments = JSON.parse(m.attachments) || [];
                        }
                      } catch { }
                      return attachments
                        .filter((a) => a.type === 'image' && a.url)
                        .map((a, i) => (
                          <div key={`${m.id}-${i}`} className="aspect-square relative rounded-lg overflow-hidden border bg-muted">
                            <img src={a.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ));
                    }).length === 0 ? (
                      <div className="col-span-full text-center text-muted-foreground py-12">No media found</div>
                    ) : messages.flatMap((m) => {
                      let attachments: { type?: string; url?: string }[] = [];
                      try {
                        if (m.attachments && typeof m.attachments === 'string') {
                          attachments = JSON.parse(m.attachments) || [];
                        }
                      } catch { }
                      return attachments.filter((a) => a.type === 'image' && a.url);
                    }).length > 0 && messages.flatMap((m) => {
                      let attachments: { type?: string; url?: string }[] = [];
                      try {
                        if (m.attachments && typeof m.attachments === 'string') {
                          attachments = JSON.parse(m.attachments) || [];
                        }
                      } catch { }
                      return attachments
                        .filter((a) => a.type === 'image' && a.url)
                        .map((a, i) => (
                          <div key={`${m.id}-${i}`} className="aspect-square relative rounded-lg overflow-hidden border bg-muted">
                            <img src={a.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ));
                    })}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Files Dialog */}
            <Dialog open={openFilesDialog} onOpenChange={setOpenFilesDialog}>
              <DialogContent className="max-w-md h-[500px] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Files</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto mt-2 space-y-2">
                  {(() => {
                    const files = messages.flatMap((m) => {
                      let attachments: { type?: string; url?: string }[] = [];
                      try {
                        if (m.attachments && typeof m.attachments === 'string') {
                          attachments = JSON.parse(m.attachments) || [];
                        }
                      } catch { }
                      return attachments
                        .filter((a) => a.type === 'file' && a.url)
                        .map((a) => ({ ...a, msgId: m.id, date: m.created_time }));
                    });

                    if (files.length === 0) return <div className="text-center text-muted-foreground py-8">No files found</div>;

                    return files.map((f, i) => (
                      <a
                        key={i}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 rounded-lg border hover:bg-muted/50"
                      >
                        <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded flex items-center justify-center mr-3">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">Attachment {i + 1}</p>
                          <p className="text-xs text-muted-foreground">{new Date(f.date as string).toLocaleDateString()}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    ));
                  })()}
                </div>
              </DialogContent>
            </Dialog>

            {/* Links Dialog */}
            <Dialog open={openLinksDialog} onOpenChange={setOpenLinksDialog}>
              <DialogContent className="max-w-md h-[500px] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Links</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto mt-2 space-y-2">
                  {(() => {
                    const links = messages.flatMap((m) => {
                      const text = m.message as string || '';
                      const urlRegex = /(https?:\/\/[^\s]+)/g;
                      const matches = text.match(urlRegex) || [];
                      return matches.map((url) => ({ url, msgId: m.id, date: m.created_time }));
                    });

                    if (links.length === 0) return <div className="text-center text-muted-foreground py-8">No links found</div>;

                    return links.map((l, i) => (
                      <a
                        key={i}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 rounded-lg border hover:bg-muted/50"
                      >
                        <div className="h-10 w-10 bg-slate-100 text-slate-600 rounded flex items-center justify-center mr-3">
                          <LinkIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.url}</p>
                          <p className="text-xs text-muted-foreground">{new Date(l.date as string).toLocaleDateString()}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    ));
                  })()}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {activeTab === 'statistics' && (
        <div className="flex-1 min-h-0 overflow-hidden mt-0 p-0 flex flex-col">
          <InboxStatistics
            pageIds={effectivePageIds}
            pageNames={pages.filter((p) => effectivePageIds.includes(p.id)).map((p) => p.name || p.id)}
            selectionMode={selectionMode}
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="flex-1 min-h-0 overflow-hidden mt-0 p-0 flex flex-col">
          <AdBoxSettings />
        </div>
      )}
    </div>
  );
}
