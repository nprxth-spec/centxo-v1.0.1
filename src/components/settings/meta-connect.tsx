'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Facebook, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function MetaConnect() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [adAccount, setAdAccount] = useState<string | null>(null);
  const [page, setPage] = useState<string | null>(null);

  const handleConnect = () => {
    setStatus('connecting');
    // Simulate API call
    setTimeout(() => {
      // In a real app, this would be the result of the OAuth flow
      // On success:
      setStatus('connected');
      // On error:
      // setStatus('error');
    }, 2000);
  };

  const handleDisconnect = () => {
    setStatus('disconnected');
    setAdAccount(null);
    setPage(null);
  };

  if (status === 'connected') {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-4 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
            <div>
                <h3 className="font-semibold text-green-800">Successfully Connected to Meta</h3>
                <p className="text-sm text-green-700">Connected as John Doe.</p>
            </div>
        </div>

        <div className="space-y-4">
            <div className="grid gap-2">
                <Label>Ad Account</Label>
                <Select onValueChange={setAdAccount} disabled={!adAccount && false}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select an ad account" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="act_12345">Personal Ad Account (act_12345)</SelectItem>
                        <SelectItem value="act_67890">Business Account (act_67890)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2">
                <Label>Facebook Page</Label>
                 <Select onValueChange={setPage} disabled={!page && false}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a page" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="page_123">My Awesome Product Page</SelectItem>
                        <SelectItem value="page_456">Cool Gadgets Inc.</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
        
        <div className="flex justify-end gap-2">
            <Button variant="destructive" onClick={handleDisconnect}>Disconnect</Button>
            <Button>Save Selection</Button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
     return (
        <div className="flex flex-col items-center justify-center text-center gap-4 p-4 rounded-lg bg-red-50 border border-red-200">
            <XCircle className="h-8 w-8 text-destructive" />
            <h3 className="font-semibold text-destructive">Connection Failed</h3>
            <p className="text-sm text-red-700">Could not connect to Facebook. Please try again.</p>
            <Button onClick={handleConnect}>
                <Facebook className="mr-2 h-4 w-4" />
                Retry Connection
            </Button>
        </div>
     );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 p-6 border-2 border-dashed rounded-lg">
      <h3 className="font-semibold">Connect to your Meta Account</h3>
      <p className="text-sm text-muted-foreground">This will allow AdPilot AI to create and manage ads on your behalf.</p>
      <Button onClick={handleConnect} disabled={status === 'connecting'}>
        {status === 'connecting' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Facebook className="mr-2 h-4 w-4" />
        )}
        {status === 'connecting' ? 'Connecting...' : 'Connect with Facebook'}
      </Button>
    </div>
  );
}
