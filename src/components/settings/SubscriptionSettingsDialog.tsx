'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { ManageAccessContent } from './ManageAccessContent';

interface SubscriptionSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subscription: any;
    onSaved?: () => void;
    onUpgrade?: () => void;
    initialTab?: string;
}

export function SubscriptionSettingsDialog({
    open,
    onOpenChange,
    subscription,
    onSaved,
    onUpgrade,
    initialTab = 'subscription',
}: SubscriptionSettingsDialogProps) {
    const { t } = useLanguage();
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
    const cleanupTimeoutRef = useRef<NodeJS.Timeout[]>([]);

    useEffect(() => {
        // Reset upgrade dialog when main dialog closes
        if (!open) {
            setShowUpgradeDialog(false);
        }
    }, [open]);

    // Aggressive cleanup for overlays and body styles
    useEffect(() => {
        // Cleanup function
        const cleanup = () => {
            // Reset body styles
            document.body.style.pointerEvents = '';
            document.body.style.overflow = '';
            document.body.removeAttribute('data-scroll-locked');

            // Remove any lingering overlay elements that are closed
            const allOverlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
            allOverlays.forEach((overlay) => {
                const element = overlay as HTMLElement;
                const state = element.getAttribute('data-state');
                // Remove if closed or if dialogs are not open
                if (state === 'closed' || (!open && !showUpgradeDialog)) {
                    element.style.display = 'none';
                    element.style.pointerEvents = 'none';
                    element.style.opacity = '0';
                    element.remove();
                }
            });

            // Also check for any portal containers that might be blocking
            const portals = document.querySelectorAll('[data-radix-portal]');
            portals.forEach((portal) => {
                const children = portal.querySelectorAll('[data-state="closed"]');
                children.forEach((child) => {
                    const el = child as HTMLElement;
                    if (el.hasAttribute('data-radix-alert-dialog-overlay') || el.hasAttribute('data-radix-dialog-overlay')) {
                        el.remove();
                    }
                });
                // Remove empty portals
                if (portal.children.length === 0) {
                    portal.remove();
                }
            });
        };

        // Cleanup when upgrade dialog closes
        if (!showUpgradeDialog) {
            cleanup();
            // Multiple delayed cleanups
            const timers = [50, 100, 200, 300, 500, 1000].map(delay =>
                setTimeout(cleanup, delay)
            );
            cleanupTimeoutRef.current.push(...timers);
        }

        // MutationObserver to watch for overlay changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const el = node as HTMLElement;
                        if (el.hasAttribute('data-radix-alert-dialog-overlay') && el.getAttribute('data-state') === 'closed') {
                            setTimeout(() => el.remove(), 100);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        return () => {
            cleanupTimeoutRef.current.forEach(timer => clearTimeout(timer));
            cleanupTimeoutRef.current = [];
            observer.disconnect();
            cleanup();
        };
    }, [showUpgradeDialog, open]);

    if (!subscription) return null;

    const packageId = subscription?.id || subscription?.packageId || '';

    return (
        <>
            <Dialog open={open} onOpenChange={(isOpen) => {
                onOpenChange(isOpen);
                // Cleanup when dialog closes
                if (!isOpen) {
                    setShowUpgradeDialog(false);
                    // Aggressive cleanup
                    const cleanup = () => {
                        document.body.style.pointerEvents = '';
                        document.body.style.overflow = '';
                        document.body.removeAttribute('data-scroll-locked');

                        // Remove any lingering overlay elements
                        const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
                        overlays.forEach((overlay) => {
                            const el = overlay as HTMLElement;
                            if (el.getAttribute('data-state') === 'closed' || !isOpen) {
                                el.remove();
                            }
                        });
                    };

                    cleanup();
                    setTimeout(cleanup, 50);
                    setTimeout(cleanup, 100);
                    setTimeout(cleanup, 200);
                }
            }}>
                <DialogContent className="!max-w-none !w-[min(75vw,840px)] !h-[76vh] !min-h-0 shrink-0 overflow-hidden flex flex-col bg-white dark:bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold font-outfit">{packageId}</DialogTitle>
                    </DialogHeader>

                    <ManageAccessContent
                        subscription={subscription}
                        initialTab={initialTab}
                        onSaved={onSaved}
                        onClose={() => onOpenChange(false)}
                        onUpgrade={onUpgrade || (() => setShowUpgradeDialog(true))}
                    />
                </DialogContent>
            </Dialog>

            <AlertDialog open={showUpgradeDialog} onOpenChange={(isOpen) => {
                setShowUpgradeDialog(isOpen);
                if (!isOpen) {
                    // Immediate cleanup
                    const cleanup = () => {
                        // Reset body styles first
                        document.body.style.pointerEvents = '';
                        document.body.style.overflow = '';
                        document.body.removeAttribute('data-scroll-locked');

                        // Force remove ALL overlay elements that are closed
                        const allOverlays = document.querySelectorAll('[data-radix-alert-dialog-overlay], [data-radix-dialog-overlay]');
                        allOverlays.forEach((overlay) => {
                            const el = overlay as HTMLElement;
                            const state = el.getAttribute('data-state');
                            // Remove if closed or if it's an alert dialog overlay
                            if (state === 'closed' || el.hasAttribute('data-radix-alert-dialog-overlay')) {
                                el.style.display = 'none';
                                el.style.pointerEvents = 'none';
                                el.style.opacity = '0';
                                el.remove();
                            }
                        });

                        // Also check for any elements with high z-index that might be blocking
                        const blockingElements = document.querySelectorAll('[style*="z-index"]');
                        blockingElements.forEach((el) => {
                            const htmlEl = el as HTMLElement;
                            const zIndex = parseInt(window.getComputedStyle(htmlEl).zIndex || '0');
                            if (zIndex >= 50 && htmlEl.getAttribute('data-state') === 'closed') {
                                htmlEl.remove();
                            }
                        });
                    };

                    cleanup();
                    // Multiple delayed cleanups to catch animation delays
                    setTimeout(cleanup, 50);
                    setTimeout(cleanup, 100);
                    setTimeout(cleanup, 200);
                    setTimeout(cleanup, 300);
                    setTimeout(cleanup, 500);
                    setTimeout(cleanup, 1000);
                }
            }}>
                <AlertDialogContent className="!z-[60]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('subDialog.upgradeTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('subDialog.upgradeDescription')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => {
                            setShowUpgradeDialog(false);
                        }}>
                            {t('subDialog.close')}
                        </Button>
                        <Button onClick={() => {
                            setShowUpgradeDialog(false);
                            // Navigate after closing dialog
                            setTimeout(() => {
                                window.location.href = '/settings?tab=subscription';
                            }, 150);
                        }}>
                            {t('subDialog.goToUpgrade')}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
