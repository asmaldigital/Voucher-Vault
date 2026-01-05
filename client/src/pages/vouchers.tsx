import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ListChecks, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Voucher, VoucherStatusType } from '@shared/schema';

const statusColors: Record<VoucherStatusType, string> = {
  available: 'bg-primary/10 text-primary border-primary/20',
  redeemed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  expired: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  voided: 'bg-destructive/10 text-destructive border-destructive/20',
};

const PAGE_SIZE = 20;

export default function VouchersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const { supabase, isReady } = useSupabase();

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/vouchers', statusFilter, searchQuery, page],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase not initialized');
      
      let query = supabase
        .from('vouchers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(`barcode.ilike.%${searchQuery}%,batch_number.ilike.%${searchQuery}%`);
      }

      const { data: vouchers, error, count } = await query;

      if (error) throw error;

      return {
        vouchers: vouchers as Voucher[],
        totalCount: count ?? 0,
      };
    },
    enabled: isReady,
  });

  const totalPages = Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-ZA', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Vouchers</h1>
        <p className="text-muted-foreground">
          View and manage all vouchers in the system
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Voucher List
          </CardTitle>
          <CardDescription>
            {data?.totalCount ?? 0} vouchers found
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by barcode or batch..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
                data-testid="input-search-vouchers"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="redeemed">Redeemed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="voided">Voided</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isReady || isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-muted-foreground">
              Failed to load vouchers. Please try again.
            </div>
          ) : data?.vouchers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No vouchers found matching your criteria.
            </div>
          ) : (
            <>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Barcode</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Redeemed</TableHead>
                      <TableHead>Redeemed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.vouchers.map((voucher) => (
                      <TableRow key={voucher.id} data-testid={`row-voucher-${voucher.id}`}>
                        <TableCell className="sticky left-0 bg-background font-mono font-medium">
                          {voucher.barcode}
                        </TableCell>
                        <TableCell>R{voucher.value}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusColors[voucher.status as VoucherStatusType]}
                          >
                            {voucher.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{voucher.batch_number}</TableCell>
                        <TableCell>{formatDate(voucher.created_at)}</TableCell>
                        <TableCell>{formatDateTime(voucher.redeemed_at)}</TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {voucher.redeemed_by_email || voucher.redeemed_by || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1} -{' '}
                  {Math.min((page + 1) * PAGE_SIZE, data?.totalCount ?? 0)} of{' '}
                  {data?.totalCount ?? 0}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
