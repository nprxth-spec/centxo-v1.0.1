'use client';

import { useState } from 'react';

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
                    } else {
                        setResult(`Action: ${d.action}`);
                    }
                    setStatus('Done');
                });
            if (builder.setRelayUrl) builder.setRelayUrl(origin);
            builder.build().setVisible(true);
        } catch (e) {
            setResult(`Error: ${e}`);
            setStatus('Done');
        }
    };

    return (
        <div className="p-8 max-w-lg mx-auto space-y-4">
            <h1 className="text-xl font-bold">Picker Test (standalone)</h1>
            <p className="text-sm text-muted-foreground">
                Minimal page to test Google Picker. If 403 here too, the issue is in Google Cloud config.
            </p>
            <button
                onClick={runTest}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
            >
                Open Picker
            </button>
            {status && <p className="text-sm">{status}</p>}
            {result && <pre className="text-xs bg-muted p-3 rounded overflow-auto">{result}</pre>}
        </div>
    );
}
