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
    setAppId?: (appId: string) => PickerBuilder;
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
    if (existing && (window as any).gapi) {
        console.log('Google API script already loaded');
        return Promise.resolve();
    }

    if (existing) {
        console.log('Script tag exists, waiting for gapi...');
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 5 seconds max
            const check = () => {
                attempts++;
                if ((window as any).gapi) {
                    console.log('gapi loaded after', attempts, 'attempts');
                    return resolve();
                }
                if (attempts >= maxAttempts) {
                    reject(new Error('Timeout waiting for Google API to load'));
                    return;
                }
                setTimeout(check, 50);
            };
            check();
        });
    }

    console.log('Loading Google API script...');
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        let attempts = 0;
        const maxAttempts = 100; // 5 seconds max
        script.onload = () => {
            console.log('Script onload fired');
            const check = () => {
                attempts++;
                if ((window as any).gapi) {
                    console.log('gapi loaded after', attempts, 'attempts');
                    return resolve();
                }
                if (attempts >= maxAttempts) {
                    reject(new Error('Timeout waiting for Google API to load'));
                    return;
                }
                setTimeout(check, 50);
            };
            check();
        };
        script.onerror = () => {
            console.error('Script failed to load');
            reject(new Error('Failed to load Google API script'));
        };
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
    apiKey?: string,
    appId?: string
): Promise<PickResult | null> {
    return loadScript()
        .then(() => {
            console.log('Script loaded, loading picker...');
            return loadPicker();
        })
        .then(() => {
            console.log('Picker loaded');
            return new Promise<PickResult | null>((resolve, reject) => {
                if (!window.google?.picker) {
                    console.error('Google Picker not available');
                    reject(new Error('Google Picker not available'));
                    return;
                }

                // Set timeout to reject if picker doesn't respond
                const timeout = setTimeout(() => {
                    console.warn('Picker timeout - no response after 5 minutes');
                    // Don't reject, just resolve null - user might still be interacting
                }, 5 * 60 * 1000);

                try {
                    const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS);
                    view.setMimeTypes('application/vnd.google-apps.spreadsheet');

                    const origin = typeof window !== 'undefined'
                        ? `${window.location.protocol}//${window.location.host}`
                        : 'http://localhost:3000';
                    const relayUrl = origin;

                    console.log('Creating picker builder...', { origin, hasApiKey: !!apiKey, hasToken: !!accessToken, hasAppId: !!appId });

                    const builder = new window.google.picker.PickerBuilder();
                    builder.addView(view);
                    builder.setOAuthToken(accessToken);

                    if (builder.setOrigin) builder.setOrigin(origin);
                    if (builder.setRelayUrl) builder.setRelayUrl(relayUrl);

                    builder.setCallback((data: PickerCallbackData) => {
                        console.log('Picker callback:', data);
                        if (data.action === 'picked' && data.docs?.length) {
                            clearTimeout(timeout);
                            const doc = data.docs[0];
                            console.log('File picked:', doc);
                            resolve({
                                id: doc.id,
                                name: doc.name || 'Untitled',
                                url: `https://docs.google.com/spreadsheets/d/${doc.id}/edit`,
                            });
                        } else if (data.action === 'cancel') {
                            clearTimeout(timeout);
                            console.log('Picker cancelled');
                            resolve(null);
                        } else if (data.action === 'loaded') {
                            console.log('Picker loaded successfully, waiting for user selection...');
                            // Don't resolve here - wait for picked or cancel
                        } else {
                            console.log('Picker action:', data.action, '- ignoring');
                            // Don't resolve for other actions - wait for picked or cancel
                        }
                    });

                    if (apiKey && builder.setDeveloperKey) {
                        builder.setDeveloperKey(apiKey);
                    }

                    if (appId && builder.setAppId) {
                        builder.setAppId(appId);
                    }

                    const picker = builder.build();
                    console.log('Showing picker...');
                    picker.setVisible(true);
                    console.log('Picker setVisible called');
                } catch (error) {
                    clearTimeout(timeout);
                    console.error('Error creating picker:', error);
                    reject(error);
                }
            });
        })
        .catch((error) => {
            console.error('Error in openGooglePicker:', error);
            throw error;
        });
}
