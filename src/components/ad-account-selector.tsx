'use client';

import { useAdAccount } from '@/contexts/AdAccountContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, ChevronDown, Loader2, RefreshCw } from 'lucide-react';

export function AdAccountSelector() {
  const { selectedAccounts, toggleAccount, adAccounts, loading, refreshData } = useAdAccount();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (adAccounts.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
        <Building2 className="h-4 w-4" />
        <span>No ad accounts</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-9 px-3 text-white hover:bg-white/20 border border-white/20">
          <Building2 className="h-4 w-4" />
          <span className="max-w-[150px] truncate text-sm">
            {selectedAccounts.length === 0
              ? 'Select Accounts'
              : selectedAccounts.length === 1
                ? selectedAccounts[0].name
                : `${selectedAccounts.length} Accounts`
            }
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[250px]">
        <DropdownMenuLabel className="text-xs text-gray-500 font-normal">
          Ad Account
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {adAccounts.map((account) => {
          const isSelected = selectedAccounts.some(acc => acc.id === account.id);
          return (
            <DropdownMenuItem
              key={account.id}
              onClick={(e) => {
                e.preventDefault();
                toggleAccount(account);
              }}
              className="cursor-pointer flex items-start gap-2 py-2"
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleAccount(account)}
                className="mt-1"
              />
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm">{account.name}</span>
                <span className="text-xs text-gray-500">ID: {account.account_id}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => refreshData(true)} className="cursor-pointer text-sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Accounts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
