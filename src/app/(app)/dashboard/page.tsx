"use client";

import { useEffect, useState } from "react";
import { getSystemStats } from "@/app/actions/get-system-stats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, Layers, Megaphone, Target, MousePointer2 } from "lucide-react";

interface SystemStats {
  users: number;
  adAccounts: number;
  campaigns: number;
  adSets: number;
  ads: number;
  teamMembers: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getSystemStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-center text-muted-foreground">Failed to load system overview.</div>;
  }

  const rows = [
    { label: "Total Users", value: stats.users, icon: Users },
    { label: "Connected Ad Accounts", value: stats.adAccounts, icon: Layers },
    { label: "Campaigns", value: stats.campaigns, icon: Megaphone },
    { label: "Ad Sets", value: stats.adSets, icon: Target },
    { label: "Ads", value: stats.ads, icon: MousePointer2 },
    { label: "Team Members", value: stats.teamMembers, icon: Users },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-page-title">System Overview</h1>
        <p className="text-muted-foreground mt-2">
          A summary of all entities currently in the system.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Statistics</CardTitle>
          <CardDescription>Real-time counts of database records.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell>
                    <row.icon className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right font-bold">{row.value.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

