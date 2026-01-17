import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  BookOpen,
  Package,
  Wallet,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import type { AuditLog, AccountSummary } from '@shared/schema';

interface BookStats {
  bookNumber: string;
  total: number;
  available: number;
  redeemed: number;
  expired: number;
  voided: number;
  totalValue: number;
  availableValue: number;
  redeemedValue: number;
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  
  const [sections, setSections] = useState({
    redemptions: true,
    books: true,
    accounts: true,
  });

  const { data: auditLogs, isLoading: reportsLoading, error: reportsError } = useQuery<AuditLog[]>({
    queryKey: ['/api/reports', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', dateRange.from.toISOString());
      params.set('endDate', dateRange.to.toISOString());

      const response = await fetch(`/api/reports?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
  });

  const { data: bookStats, isLoading: bookStatsLoading } = useQuery<BookStats[]>({
    queryKey: ['/api/reports/books'],
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery<AccountSummary[]>({
    queryKey: ['/api/accounts/summaries'],
  });

  const { data: dashboardStats, isLoading: dashboardLoading } = useQuery<any>({
    queryKey: ['/api/dashboard/stats'],
  });

  const redemptions = auditLogs?.filter((log) => log.action === 'redeemed') ?? [];
  const redemptionsTotalValue = redemptions.reduce((sum, log) => {
    const details = log.details as { value?: number } | null;
    return sum + (details?.value || 50);
  }, 0);
  const uniqueUsers = new Set(redemptions.map((log) => log.userId)).size;

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString('en-ZA')}`;
  };

  const formatDate = (dateString?: string | Date | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString?: string | Date | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const exportAllToCSV = () => {
    if (!redemptions.length && !bookStats?.length && !accounts?.length) return;

    let csvContent = '';

    // Section 1: Redemptions
    if (sections.redemptions && redemptions.length) {
      csvContent += 'REDEMPTIONS REPORT\n';
      csvContent += `Period: ${format(dateRange.from, 'dd MMM yyyy')} to ${format(dateRange.to, 'dd MMM yyyy')}\n\n`;
      const redHeaders = ['Action', 'User', 'Date', 'Time', 'Value', 'Details'];
      const redRows = redemptions.map((log) => [
        log.action,
        log.userEmail || log.userId || '',
        log.timestamp ? new Date(log.timestamp).toLocaleDateString('en-ZA') : '',
        log.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-ZA') : '',
        (log.details as { value?: number } | null)?.value || 50,
        JSON.stringify(log.details || {}),
      ]);
      csvContent += [redHeaders.join(','), ...redRows.map((r) => r.join(','))].join('\n');
      csvContent += '\n\n';
    }

    // Section 2: Book Summary
    if (sections.books && bookStats?.length) {
      csvContent += 'BOOK SUMMARY REPORT\n';
      csvContent += `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}\n\n`;
      const bookHeaders = ['Book Number', 'Total Vouchers', 'Available', 'Redeemed', 'Expired', 'Voided', 'Total Value', 'Available Value', 'Redeemed Value'];
      const bookRows = bookStats.map((book) => [
        book.bookNumber,
        book.total,
        book.available,
        book.redeemed,
        book.expired,
        book.voided,
        book.totalValue,
        book.availableValue,
        book.redeemedValue,
      ]);
      csvContent += [bookHeaders.join(','), ...bookRows.map((r) => r.join(','))].join('\n');
      csvContent += '\n\n';
    }

    // Section 3: Accounts
    if (sections.accounts && accounts?.length) {
      csvContent += 'ACCOUNTS REPORT\n';
      csvContent += `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}\n\n`;
      const accHeaders = ['Account Name', 'Contact Name', 'Email', 'Phone', 'Total Received', 'Total Redeemed', 'Remaining Balance'];
      const accRows = accounts.map((acc) => [
        acc.name,
        acc.contactName || '',
        acc.email || '',
        acc.phone || '',
        acc.totalPurchased,
        acc.totalRedeemed,
        acc.remainingBalance,
      ]);
      csvContent += [accHeaders.join(','), ...accRows.map((r) => r.join(','))].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supersave_complete_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalBooks = bookStats?.length ?? 0;
  const totalAvailableValue = bookStats?.reduce((sum, b) => sum + b.availableValue, 0) ?? 0;
  const totalRedeemedValue = bookStats?.reduce((sum, b) => sum + b.redeemedValue, 0) ?? 0;
  const totalVouchers = bookStats?.reduce((sum, b) => sum + b.total, 0) ?? 0;
  const availableVouchers = bookStats?.reduce((sum, b) => sum + b.available, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comprehensive Reports</h1>
          <p className="text-muted-foreground">
            Unified view of redemptions, books, and accounts
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportAllToCSV}
          disabled={reportsLoading || bookStatsLoading || accountsLoading}
          data-testid="button-export"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Complete Report
        </Button>
      </div>

      {/* Dashboard Metrics Header */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dashboardLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Vouchers</CardTitle>
                <Ticket className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats?.totalVouchers ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats?.availableVouchers ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Redeemed Today</CardTitle>
                <CalendarIcon className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats?.redeemedToday ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Redeemed</CardTitle>
                <TrendingUp className="h-5 w-5 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardStats?.redeemedTotal ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Value</CardTitle>
                <Banknote className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency((dashboardStats?.totalValue ?? 0) - (dashboardStats?.redeemedValue ?? 0))}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Redeemed Value</CardTitle>
                <Banknote className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardStats?.redeemedValue ?? 0)}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters Section */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="show-redemptions" 
                  checked={sections.redemptions} 
                  onCheckedChange={(checked) => setSections(s => ({ ...s, redemptions: !!checked }))}
                />
                <Label htmlFor="show-redemptions" className="cursor-pointer">Redemption History</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="show-books" 
                  checked={sections.books} 
                  onCheckedChange={(checked) => setSections(s => ({ ...s, books: !!checked }))}
                />
                <Label htmlFor="show-books" className="cursor-pointer">Book Summary</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="show-accounts" 
                  checked={sections.accounts} 
                  onCheckedChange={(checked) => setSections(s => ({ ...s, accounts: !!checked }))}
                />
                <Label htmlFor="show-accounts" className="cursor-pointer">Accounts Overview</Label>
              </div>
            </div>

            {sections.redemptions && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                <span className="text-sm font-medium mr-2">Redemption Period:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
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
                    <Button variant="outline" size="sm" className="gap-2">
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Redemptions Section */}
      {sections.redemptions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              Redemption History
            </CardTitle>
            <CardDescription>
              Detailed log of voucher redemptions for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : auditLogs?.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No redemptions found.</div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="max-w-[200px] truncate">{log.userEmail || log.userId || '-'}</TableCell>
                        <TableCell>{formatDate(log.timestamp)}</TableCell>
                        <TableCell>{formatTime(log.timestamp)}</TableCell>
                        <TableCell><Badge variant="secondary">R{(log.details as any)?.value || 50}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Book Summary Section */}
      {sections.books && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Book Summary
            </CardTitle>
            <CardDescription>
              Voucher totals and values organized by book number
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookStatsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !bookStats?.length ? (
              <div className="py-8 text-center text-muted-foreground">No book statistics found.</div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Book Number</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">RedeemedValue</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookStats.map((book) => (
                      <TableRow key={book.bookNumber}>
                        <TableCell className="font-mono">{book.bookNumber}</TableCell>
                        <TableCell className="text-right">{book.total}</TableCell>
                        <TableCell className="text-right"><Badge variant="outline">{book.available}</Badge></TableCell>
                        <TableCell className="text-right">{formatCurrency(book.redeemedValue)}</TableCell>
                        <TableCell className="text-right text-primary font-medium">{formatCurrency(book.availableValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Accounts Section */}
      {sections.accounts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Accounts Overview
            </CardTitle>
            <CardDescription>
              Bulk buyer account balances and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !accounts?.length ? (
              <div className="py-8 text-center text-muted-foreground">No accounts found.</div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Redeemed</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(acc.totalPurchased)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(acc.totalRedeemed)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={acc.remainingBalance > 0 ? "default" : "secondary"}>
                            {formatCurrency(acc.remainingBalance)}
                          </Badge>
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
      )}
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';
