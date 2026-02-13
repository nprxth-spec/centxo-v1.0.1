'use client';

import { useState } from 'react';
import Script from 'next/script';

/**
 * Standalone Picker test page - minimal setup to debug 403.
 * Navigate to /picker-test (must be logged in).
 */
export default function PickerTestPage() {
    const [status, setStatus] = useState<string>('');
    const [result, setResult] = useState<string>('');

    const runTest = async () => {
        setStatus('Loading...');
        setResult('');
        try {
            const tokenRes = await fetch('/api/google-sheets/picker-token');
            const data = await tokenRes.json();
            if (!tokenRes.ok || !data.accessToken) {
                setResult(`Token error: ${JSON.stringify(data)}`);
                setStatus('Done');
                return;
            }
            setStatus('Token OK, loading gapi...');

            await new Promise<void>((resolve, reject) => {
                if ((window as any).gapi) return resolve();
                const s = document.createElement('script');
                s.src = 'https://apis.google.com/js/api.js';
                s.onload = () => {
                    const check = () => ((window as any).gapi ? resolve() : setTimeout(check, 50));
                    check();
                };
                s.onerror = () => reject(new Error('gapi load failed'));
                document.head.appendChild(s);
            });

            setStatus('Loading picker...');

            await new Promise<void>((resolve, reject) => {
                (window as any).gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('picker load failed')) });
            });

            const g = (window as any).google?.picker;
            if (!g) {
                setResult('google.picker not found');
                setStatus('Done');
                return;
            }

            setStatus('Opening Picker...');

            const view = new g.DocsView(g.ViewId.SPREADSHEETS);
            view.setMimeTypes('application/vnd.google-apps.spreadsheet');

            const origin = `${window.location.protocol}//${window.location.host}`;
            const builder = new g.PickerBuilder()
                .addView(view)
                .setOAuthToken(data.accessToken)
                .setOrigin(origin)
                .setCallback((d: { action: string; docs?: { id: string; name: string }[] }) => {
                    if (d.action === 'picked' && d.docs?.[0]) {
                        setResult(`Picked: ${d.docs[0].name} (${d.docs[0].id})`);
                    } else if (d.action === 'cancel') {
                        setResult('Action: Cancelled by user');
                    } else {
                        setResult(`Action: ${d.action} (Docs: ${JSON.stringify(d.docs)})`);
                    }
                    setStatus('Done');
                });

            console.log('Using Access Token:', data.accessToken ? 'Present' : 'Missing');
            console.log('Using API Key:', data.apiKey ? data.apiKey.substring(0, 10) + '...' : 'Missing');

            if (data.apiKey) {
                builder.setDeveloperKey(data.apiKey);
            } else {
                setResult('Warning: No API Key found in token response');
            }

            if ((data as any).appId) {
                builder.setAppId((data as any).appId);
                console.log('Using App ID:', (data as any).appId);
            }

            if (builder.setRelayUrl) builder.setRelayUrl(origin);
            builder.build().setVisible(true);
        } catch (e) {
            setResult(`Error: ${e}`);
            setStatus('Done');
        }
    };

    const handleClientSideAuth = () => {
        if (!(window as any).google) {
            setStatus('Error: Google Identity Services script not loaded');
            return;
        }
        setStatus('Initializing Client-Side Auth...');
        const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '787991868558-uqks5m53bdp4mbnrbl8itrdli9rmls57.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (response: any) => {
                if (response.access_token) {
                    setStatus('Got Client Token! Opening Picker...');
                    const g = (window as any).google.picker;
                    const view = new g.DocsView(g.ViewId.SPREADSHEETS);
                    view.setMimeTypes('application/vnd.google-apps.spreadsheet');
                    const origin = `${window.location.protocol}//${window.location.host}`;

                    fetch('/api/google-sheets/picker-token').then(res => res.json()).then(data => {
                        const builder = new g.PickerBuilder()
                            .addView(view)
                            .setOAuthToken(response.access_token)
                            .setOrigin(origin)
                            .setDeveloperKey(data.apiKey)
                            .setAppId(data.appId) // Add App ID - required for Picker!
                            .setCallback((d: any) => {
                                if (d.action === 'picked') {
                                    setResult(`Picked (Client Auth): ${d.docs[0].name}`);
                                } else if (d.action === 'cancel') {
                                    setResult('Action: Cancelled');
                                }
                            });
                        builder.build().setVisible(true);
                    });
                } else {
                    setStatus('Auth Failed');
                }
            },
        });
        client.requestAccessToken();
    };

    const validateApiKey = async () => {
        setStatus('Validating API Key...');
        const res = await fetch('/api/google-sheets/picker-token');
        const data = await res.json();
        const key = data.apiKey;
        if (!key) {
            setResult('No API Key found to test');
            return;
        }

        try {
            const testUrl = `https://www.googleapis.com/drive/v3/about?key=${key}&fields=user`;
            setStatus(`Fetching ${testUrl}...`);
            const apiRes = await fetch(testUrl);
            const apiJson = await apiRes.json();

            if (apiRes.ok) {
                setResult(`Success! API Key is valid.\nResponse: ${JSON.stringify(apiJson, null, 2)}`);
            } else {
                setResult(`API Key Error (${apiRes.status}):\n${JSON.stringify(apiJson, null, 2)}`);
            }
        } catch (e) {
            setResult(`Validation Network Error: ${e}`);
        }
    };

    return (
        <div className="p-8 max-w-lg mx-auto space-y-4">
            <h1 className="text-xl font-bold">Picker Test (standalone)</h1>
            <p className="text-sm text-muted-foreground">
                Minimal page to test Google Picker. If 403 here too, the issue is in Google Cloud config.
            </p>
            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <button
                        onClick={runTest}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
                    >
                        Open Picker (Server Token)
                    </button>
                    <button
                        onClick={handleClientSideAuth}
                        className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90 border"
                    >
                        Login & Pick (Client Token)
                    </button>
                    <button
                        onClick={validateApiKey}
                        className="px-4 py-2 bg-orange-100 text-orange-800 border-orange-200 border rounded-md hover:opacity-90"
                    >
                        Check API Key
                    </button>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 text-xs rounded">
                    <strong>Check:</strong> Are third-party cookies blocked? (Incognito / Brave shields often block Picker)
                </div>
            </div>
            {status && <p className="text-sm">{status}</p>}
            {result && <pre className="text-xs bg-muted p-3 rounded overflow-auto">{result}</pre>}
            <Script
                src="https://accounts.google.com/gsi/client"
                strategy="afterInteractive"
                onLoad={() => {
                    console.log('GSI Script loaded');
                    setStatus('GSI Script loaded and ready.');
                }}
                onError={() => setStatus('Error loading GSI Script')}
            />
        </div>
    );
}
