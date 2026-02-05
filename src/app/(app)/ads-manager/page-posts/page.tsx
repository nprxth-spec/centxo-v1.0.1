'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchPages } from '@/app/actions/adbox';
import { Button } from '@/components/ui/button';
import { NoFacebookAccountsPrompt } from '@/components/NoFacebookAccountsPrompt';
import {
  MessageSquare,
  Loader2,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type PageInfo = { id: string; name: string; picture?: { data?: { url?: string } } };
type Post = {
  id: string;
  message: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  likes: number;
  commentsCount: number;
  isAdPost?: boolean;
};
type Comment = {
  id: string;
  message: string;
  from?: { name?: string; id?: string };
  created_time: string;
  like_count: number;
};

export default function PagePostsPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const [hasTeamMembers, setHasTeamMembers] = useState<boolean | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [selectedPage, setSelectedPage] = useState<PageInfo | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ commentId: string; postId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/team/has-members');
        const data = await res.json();
        setHasTeamMembers(data.hasMembers === true);
      } catch {
        setHasTeamMembers(false);
      }
    };
    if (session?.user) check();
  }, [session]);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await fetchPages();
        setPages(list as PageInfo[]);
        if (list.length > 0 && !selectedPage) {
          setSelectedPage(list[0] as PageInfo);
        }
      } catch (err) {
        console.error(err);
        setPages([]);
      }
    };
    if (session?.user && hasTeamMembers) load();
  }, [session, hasTeamMembers]);

  useEffect(() => {
    if (!selectedPage?.id) return;
    setLoadingPosts(true);
    setPosts([]);
    setExpandedPostId(null);
    fetch(`/api/facebook/pages/${selectedPage.id}/posts?limit=25`)
      .then((r) => r.json())
      .then((data) => {
        if (data.posts) setPosts(data.posts);
      })
      .catch(console.error)
      .finally(() => setLoadingPosts(false));
  }, [selectedPage?.id]);

  const loadComments = (postId: string, forceRefresh = false) => {
    if (!selectedPage?.id) return;
    const isClosing = !forceRefresh && expandedPostId === postId;
    if (isClosing) {
      setExpandedPostId(null);
      setComments([]);
      return;
    }
    setLoadingComments(true);
    setExpandedPostId(postId);
    const url = `/api/facebook/posts/${postId}/comments?pageId=${selectedPage.id}${forceRefresh ? `&_t=${Date.now()}` : ''}`;
    fetch(url, forceRefresh ? { cache: 'no-store' } : undefined)
      .then((r) => r.json())
      .then((data) => {
        if (data.comments) setComments(data.comments);
      })
      .catch(console.error)
      .finally(() => setLoadingComments(false));
  };

  const handleDeleteComment = async () => {
    if (!deleteTarget || !selectedPage?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/facebook/comments/${deleteTarget.commentId}?pageId=${selectedPage.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.filter((c) => c.id !== deleteTarget.commentId));
        setPosts((prev) =>
          prev.map((p) =>
            p.id === deleteTarget.postId
              ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) }
              : p
          )
        );
        setDeleteTarget(null);
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (e) {
      alert('Failed to delete comment');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return s;
    }
  };

  if (hasTeamMembers === null) {
    return (
      <div className="h-full p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!hasTeamMembers) {
    return (
      <div className="h-full p-4 md:p-6 lg:p-8">
        <NoFacebookAccountsPrompt />
      </div>
    );
  }

  return (
    <div className="h-full p-4 md:p-6 lg:p-8 flex flex-col overflow-hidden">
      <div className="flex flex-col h-full max-w-4xl">
        <div className="flex-shrink-0 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('pagePosts.title', 'Manage Comments')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {t('pagePosts.subtitle', 'View and delete comments on your Page posts')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('pagePosts.selectPage', 'Page')}:
          </span>
          <select
            value={selectedPage?.id ?? ''}
            onChange={(e) => {
              const p = pages.find((x) => x.id === e.target.value);
              if (p) setSelectedPage(p);
            }}
            className="px-3 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-sm min-w-[200px]"
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!selectedPage?.id) return;
              setLoadingPosts(true);
              fetch(`/api/facebook/pages/${selectedPage.id}/posts?limit=25`)
                .then((r) => r.json())
                .then((data) => {
                  if (data.posts) setPosts(data.posts);
                })
                .finally(() => setLoadingPosts(false));
            }}
            disabled={loadingPosts}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingPosts ? 'animate-spin' : ''}`} />
            {t('campaigns.refresh', 'Refresh')}
          </Button>
        </div>

        <div className="flex-1 overflow-auto space-y-4">
          {loadingPosts ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin mb-2" />
              <p>{t('pagePosts.loadingPosts', 'Loading posts...')}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg bg-card">
              <FileText className="h-12 w-12 mb-2 opacity-50" />
              <p>{t('pagePosts.noPosts', 'No posts found for this Page')}</p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="border border-gray-200 dark:border-zinc-800 rounded-xl bg-card overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap line-clamp-3">
                        {post.message || t('pagePosts.noMessage', '(No text)')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(post.created_time)}
                        </p>
                        {post.isAdPost && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                            {t('pagePosts.adPost', 'Ad')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>❤️ {post.likes}</span>
                        <span>💬 {post.commentsCount}</span>
                      </div>
                    </div>
                    {post.permalink_url && (
                      <a
                        href={post.permalink_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  {post.full_picture && (
                    <img
                      src={post.full_picture}
                      alt=""
                      className="mt-3 rounded-lg max-h-48 object-cover"
                    />
                  )}
                  {post.commentsCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={() => loadComments(post.id)}
                      disabled={loadingComments}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {expandedPostId === post.id ? (
                        <>
                          {t('pagePosts.hideComments', 'Hide comments')}
                          <ChevronUp className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          {t('pagePosts.viewComments', 'View comments')} ({post.commentsCount})
                          <ChevronDown className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {expandedPostId === post.id && (
                  <div className="border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('pagePosts.comments', 'Comments')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadComments(post.id, true)}
                        disabled={loadingComments}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${loadingComments ? 'animate-spin' : ''}`} />
                        {t('pagePosts.refreshComments', 'Refresh')}
                      </Button>
                    </div>
                    {loadingComments ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        {t('pagePosts.noComments', 'No comments')}
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {comments.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-start justify-between gap-3 p-3 rounded-lg bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300" title={!c.from?.name ? t('pagePosts.commentAuthorNote', 'Meta may restrict commenter names for privacy') : undefined}>
                                {c.from?.name ?? (c.from?.id ? t('pagePosts.commentAuthorId', 'Commenter #%s').replace('%s', String(c.from.id).slice(-6)) : t('pagePosts.commentAuthor', 'Commenter'))}
                              </p>
                              <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 whitespace-pre-wrap">
                                {c.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(c.created_time)}
                                {c.like_count > 0 && ` · ❤️ ${c.like_count}`}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => setDeleteTarget({ commentId: c.id, postId: post.id })}
                              title={t('pagePosts.deleteComment', 'Delete comment')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {t('pagePosts.deleteConfirmTitle', 'Delete comment?')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('pagePosts.deleteConfirmDesc', 'This action cannot be undone.')}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteComment}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t('pagePosts.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
