import { getCampaignById, getAdsForCampaign } from '@/lib/data';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Copy, Trash2, DollarSign, MessageSquare, BarChart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/page-header';

export default async function CampaignDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const campaign = await getCampaignById(params.id);
  const ads = await getAdsForCampaign(params.id);

  if (!campaign) {
    notFound();
  }

  const campaignMetrics = [
    { label: 'Spend Today', value: `$${campaign.insights.spend.toFixed(2)}`, icon: DollarSign },
    { label: 'Messages', value: campaign.insights.messages, icon: MessageSquare },
    { label: 'Cost Per Message', value: `$${campaign.insights.costPerMessage.toFixed(2)}`, icon: BarChart },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={campaign.name}
        subtitle={`Created on ${new Date(campaign.createdAt).toLocaleDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              {campaign.status === 'ACTIVE' ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {campaign.status === 'ACTIVE' ? 'Pause Campaign' : 'Resume Campaign'}
            </Button>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Campaign
            </Button>
          </div>
        }
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Campaign Details' }
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {campaignMetrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ads Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="text-right">Cost/Message</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell className="font-medium">{ad.name}</TableCell>
                  <TableCell>
                    <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'} className={ad.isWinner ? 'bg-accent text-accent-foreground' : ''}>
                      {ad.isWinner ? 'WINNER' : ad.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">${ad.insights.spend.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{ad.insights.messages}</TableCell>
                  <TableCell className="text-right">${ad.insights.costPerMessage.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {ad.status === 'ACTIVE' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
