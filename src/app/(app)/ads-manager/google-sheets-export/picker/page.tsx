'use client';

import { useEffect, useState } from 'react';

/**
 * Dedicated Picker page - opens in popup to avoid 403 from complex parent context.
 * Fetches token, opens Google Picker, postMessages result to opener.
 */
export default function PickerPage() {
    const [status, setStatus] = useState<'loading' | 'picker' | 'done' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch('/api/google-sheets/picker-token');
                const data = await res.json();
                if (!mounted) return;
                if (!res.ok || !data.accessToken) {
                    setError('Failed to get token');
                    setStatus('error');
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/api.js';
                script.async = true;
                script.onload = () => {
                    if (!mounted) return;
                    (window as any).gapi?.load?.('picker', {
                        callback: () => {
                            if (!mounted || !(window as any).google?.picker) {
                                setError('Picker not loaded');
                                setStatus('error');
                                return;
                            }
                            const g = (window as any).google.picker;
                            const view = new g.DocsView(g.ViewId.SPREADSHEETS);
                            view.setMimeTypes('application/vnd.google-apps.spreadsheet');

                            const origin = `${window.location.protocol}//${window.location.host}`;
                            const builder = new g.PickerBuilder()
                                .addView(view)
                                .setOAuthToken(data.accessToken)
                                .setOrigin(origin)
                                .setRelayUrl?.(origin)
                                .setCallback((d: { action: string; docs?: { id: string; name: string }[] }) => {
                                    if (!mounted) return;
                                    if (d.action === 'picked' && d.docs?.[0]) {
                                        const doc = d.docs[0];
                                        if (window.opener) {
                                            window.opener.postMessage(
                                                { type: 'GOOGLE_PICKER_PICKED', id: doc.id, name: doc.name || 'Untitled' },
                                                origin
                                            );
                                        }
                                        setStatus('done');
                                        window.close();
                                    } else {
                                        setStatus('done');
                                        window.close();
                                    }
                                });

                            // Omit API key - Picker can work with OAuth token alone; key from wrong project causes 403
                            // if (data.apiKey) builder.setDeveloperKey?.(data.apiKey);
                            builder.build().setVisible(true);
                            setStatus('picker');
                        },
                        onerror: () => {
                            if (mounted) {
                                setError('Failed to load Picker');
                                setStatus('error');
                            }
                        },
                    });
                };
                script.onerror = () => {
                    if (mounted) {
                        setError('Failed to load Google API');
                        setStatus('error');
                    }
                };
                document.head.appendChild(script);
            } catch (e) {
                if (mounted) {
                    setError(String(e));
                    setStatus('error');
                }
            }
        })();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-8">
            {status === 'loading' && (
                <p className="text-muted-foreground">Loading Google Picker...</p>
            )}
            {status === 'picker' && (
                <p className="text-muted-foreground">Select a Google Sheet...</p>
            )}
            {status === 'error' && (
                <div className="text-center">
                    <p className="text-destructive font-medium">{error}</p>
                    <button
                        onClick={() => window.close()}
                        className="mt-4 text-sm text-primary hover:underline"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}
