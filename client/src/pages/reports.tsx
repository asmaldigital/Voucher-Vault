import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  FileBarChart,
  CalendarIcon,
  Download,
  TrendingUp,
  Banknote,
  Ticket,
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import type { Voucher } from '@shared/schema';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const { supabase, isReady } = useSupabase();

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/reports', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not initialized');
      
      const fromDate = startOfDay(dateRange.from).toISOString();
      const toDate = endOfDay(dateRange.to).toISOString();

      const { data: redemptions, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('status', 'redeemed')
        .gte('redeemed_at', fromDate)
        .lte('redeemed_at', toDate)
        .order('redeemed_at', { ascending: false });

      if (error) throw error;

      const totalValue = redemptions?.reduce((sum, v) => sum + (v.value || 50), 0) ?? 0;
      const uniqueUsers = new Set(redemptions?.map((v) => v.redeemed_by)).size;

      return {
        redemptions: redemptions as Voucher[],
        totalCount: redemptions?.length ?? 0,
        totalValue,
        uniqueUsers,
      };
    },
    enabled: isReady,
  });

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const exportToCSV = () => {
    if (!data?.redemptions.length) return;

    const headers = ['Barcode', 'Value', 'Batch', 'Redeemed At', 'Redeemed By'];
    const rows = data.redemptions.map((v) => [
      v.barcode,
      `R${v.value}`,
      v.batch_number,
      v.redeemed_at ? new Date(v.redeemed_at).toLocaleString('en-ZA') : '',
      v.redeemed_by_email || v.redeemed_by || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redemptions_${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          View redemption history and generate reports
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-date-from">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.from, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => date && setDateRange((r) => ({ ...r, from: date }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-date-to">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.to, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.to}
                onSelect={(date) => date && setDateRange((r) => ({ ...r, to: date }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button
          variant="outline"
          onClick={exportToCSV}
          disabled={!data?.redemptions.length}
          data-testid="button-export"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {!isReady || isLoading ? (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="mt-2 h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                    <Ticket className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold" data-testid="stat-total-redemptions">
                      {data?.totalCount ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Redemptions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                    <Banknote className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold" data-testid="stat-total-value">
                      R{(data?.totalValue ?? 0).toLocaleString('en-ZA')}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold" data-testid="stat-unique-users">
                      {data?.uniqueUsers ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Staff Members</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5" />
            Redemption History
          </CardTitle>
          <CardDescription>
            Detailed log of all voucher redemptions in the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isReady || isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-muted-foreground">
              Failed to load report data. Please try again.
            </div>
          ) : data?.redemptions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No redemptions found in the selected date range.
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Barcode</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Redeemed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.redemptions.map((voucher) => (
                    <TableRow key={voucher.id} data-testid={`report-row-${voucher.id}`}>
                      <TableCell className="sticky left-0 bg-background font-mono font-medium">
                        {voucher.barcode}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">R{voucher.value}</Badge>
                      </TableCell>
                      <TableCell>{voucher.batch_number}</TableCell>
                      <TableCell>{formatDate(voucher.redeemed_at)}</TableCell>
                      <TableCell>{formatTime(voucher.redeemed_at)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {voucher.redeemed_by_email || voucher.redeemed_by || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
