'use client';

/**
 * Meta Connection Settings Page
 * Connect Facebook account, select ad account and page
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';

export default function MetaSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [isConnected, setIsConnected] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedPage, setSelectedPage] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      // Fetch launch, accounts, and pages in parallel for faster load
      const [launchRes, accountsRes, pagesRes] = await Promise.all([
        fetch('/api/launch'),
        fetch('/api/meta/select?type=accounts'),
        fetch('/api/meta/select?type=pages'),
      ]);

      const launchData = await launchRes.json().catch(() => ({}));
      const accountsData = await accountsRes.json().catch(() => ({}));
      const pagesData = await pagesRes.json().catch(() => ({}));

      const connected = launchData.checks?.metaConnected || false;
      setIsConnected(connected);
      setAccounts(accountsData.accounts || []);
      setPages(pagesData.pages || []);
    } catch (err) {
      console.error('Error checking connection:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    
    try {
      const response = await fetch('/api/meta/connect');
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError('Failed to initiate Facebook connection');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveSelection = async () => {
    if (!selectedAccount || !selectedPage) {
      setError('Please select both an ad account and a page');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const account = accounts.find((a) => a.id === selectedAccount);
      const page = pages.find((p) => p.id === selectedPage);

      const response = await fetch('/api/meta/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adAccountId: account.id,
          adAccountName: account.name,
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token,
        }),
      });

      if (response.ok) {
        setSuccess('Settings saved successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Skeleton className="h-12 w-[300px] mb-8" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Meta Connection Settings</h1>
        <p className="text-muted-foreground">
          Connect your Facebook account to launch Messages campaigns
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-600 bg-green-50 text-green-900">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Connect Facebook */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>1. Connect Facebook Account</CardTitle>
              <CardDescription>
                Authorize access to your Facebook Business account
              </CardDescription>
            </div>
            {isConnected && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <Button
              onClick={handleConnect}
              disabled={connecting}
              size="lg"
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect Facebook
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Your Facebook account is connected. You can now select an ad account and page.
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                onClick={handleConnect}
                disabled={connecting}
              >
                Reconnect Facebook
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Select Ad Account */}
      {isConnected && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>2. Select Ad Account</CardTitle>
            <CardDescription>
              Choose which ad account to use for campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select an ad account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Select Page */}
      {isConnected && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>3. Select Facebook Page</CardTitle>
            <CardDescription>
              Choose which page will receive messages from ads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedPage} onValueChange={setSelectedPage}>
              <SelectTrigger>
                <SelectValue placeholder="Select a page" />
              </SelectTrigger>
              <SelectContent>
                {pages.map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      {isConnected && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveSelection}
            disabled={!selectedAccount || !selectedPage || saving}
            size="lg"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      )}

      {/* Help Text */}
      <Alert className="mt-8">
        <AlertDescription>
          <strong>Note:</strong> You need to have admin access to a Facebook Business account
          with an active ad account and a Facebook Page to use this app.
        </AlertDescription>
      </Alert>
    </div>
  );
}
