/**
 * Google Picker - uses drive.file scope for per-file access.
 * User selects a spreadsheet via Picker; we get access to that file only.
 */

declare global {
    interface Window {
        gapi?: {
            load: (name: string, options: { callback: () => void; onerror?: (err: Error) => void }) => void;
        };
        google?: {
            picker: {
                PickerBuilder: new () => PickerBuilder;
                ViewId: { SPREADSHEETS: string };
                DocsView: new (viewId: string) => DocsView;
            };
        };
    }
}

interface PickerBuilder {
    addView: (view: DocsView) => PickerBuilder;
    setOAuthToken: (token: string) => PickerBuilder;
    setOrigin?: (origin: string) => PickerBuilder;
    setRelayUrl?: (url: string) => PickerBuilder;
    setDeveloperKey?: (key: string) => PickerBuilder;
    setCallback: (callback: (data: PickerCallbackData) => void) => PickerBuilder;
    build: () => { setVisible: (visible: boolean) => void };
}

interface DocsView {
    setMimeTypes: (mimeTypes: string) => DocsView;
}

interface PickerDocument {
    id: string;
    name: string;
}

interface PickerCallbackData {
    action: string;
    docs?: PickerDocument[];
}

const SCRIPT_URL = 'https://apis.google.com/js/api.js';

function loadScript(): Promise<void> {
    if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing && (window as any).gapi) return Promise.resolve();

    if (existing) {
        return new Promise((resolve) => {
            const check = () => {
                if ((window as any).gapi) return resolve();
                setTimeout(check, 50);
            };
            check();
        });
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        script.onload = () => {
            const check = () => {
                if ((window as any).gapi) return resolve();
                setTimeout(check, 50);
            };
            check();
        };
        script.onerror = () => reject(new Error('Failed to load Google API script'));
        document.head.appendChild(script);
    });
}

function loadPicker(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!window.gapi) {
            reject(new Error('Google API not loaded'));
            return;
        }
        window.gapi.load('picker', {
            callback: resolve,
            onerror: (err) => reject(err || new Error('Failed to load Picker')),
        });
    });
}

export interface PickResult {
    id: string;
    name: string;
    url: string;
}

export function openGooglePicker(
    accessToken: string,
    apiKey?: string
): Promise<PickResult | null> {
    return loadScript()
        .then(loadPicker)
        .then(
            () =>
                new Promise<PickResult | null>((resolve) => {
                    if (!window.google?.picker) {
                        resolve(null);
                        return;
                    }

                    const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS);
                    view.setMimeTypes('application/vnd.google-apps.spreadsheet');

                    const origin = typeof window !== 'undefined'
                        ? `${window.location.protocol}//${window.location.host}`
                        : 'http://localhost:3000';
                    const relayUrl = origin;
                    const builder = new window.google.picker.PickerBuilder()
                        .addView(view)
                        .setOAuthToken(accessToken)
                        .setOrigin?.(origin)
                        .setRelayUrl?.(relayUrl)
                        .setCallback((data: PickerCallbackData) => {
                            if (data.action === 'picked' && data.docs?.length) {
                                const doc = data.docs[0];
                                resolve({
                                    id: doc.id,
                                    name: doc.name || 'Untitled',
                                    url: `https://docs.google.com/spreadsheets/d/${doc.id}/edit`,
                                });
                            } else {
                                resolve(null);
                            }
                        });

                    if (builder) {
                        if (apiKey) builder.setDeveloperKey?.(apiKey);
                        builder.build().setVisible(true);
                    }
                })
        );
}
