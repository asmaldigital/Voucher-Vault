import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Wallet, Plus, User, Mail, Phone, FileText, Loader2 } from 'lucide-react';
import type { Account } from '@shared/schema';

interface AccountWithStats extends Account {
  totalVouchers: number;
  availableVouchers: number;
  redeemedVouchers: number;
  totalValue: number;
  availableValue: number;
}

export default function AccountsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    notes: '',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery<AccountWithStats[]>({
    queryKey: ['/api/accounts'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/accounts', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      setIsDialogOpen(false);
      setFormData({ name: '', contactName: '', email: '', phone: '', notes: '' });
      toast({
        title: 'Account created',
        description: 'The bulk buyer account has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to create account',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Account name is required',
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  const totalStats = accounts?.reduce(
    (acc, account) => ({
      totalVouchers: acc.totalVouchers + account.totalVouchers,
      availableValue: acc.availableValue + account.availableValue,
      accountCount: acc.accountCount + 1,
    }),
    { totalVouchers: 0, availableValue: 0, accountCount: 0 }
  ) || { totalVouchers: 0, availableValue: 0, accountCount: 0 };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">
            Manage bulk buyer accounts and their voucher allocations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Bulk Buyer Account</DialogTitle>
              <DialogDescription>
                Add a new account for tracking bulk voucher purchases
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Account Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., ABC Corporation"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-account-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Person</Label>
                  <Input
                    id="contactName"
                    placeholder="e.g., John Smith"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    data-testid="input-contact-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@company.co.za"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      data-testid="input-account-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="+27 82 123 4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      data-testid="input-account-phone"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional information..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    data-testid="input-account-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-account">
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-accounts">
              {isLoading ? <Skeleton className="h-8 w-16" /> : totalStats.accountCount}
            </div>
            <p className="text-xs text-muted-foreground">Bulk buyer accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vouchers</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-account-vouchers">
              {isLoading ? <Skeleton className="h-8 w-16" /> : totalStats.totalVouchers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Allocated to accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Value</CardTitle>
            <Badge variant="secondary">ZAR</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-available-account-value">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalStats.availableValue)}
            </div>
            <p className="text-xs text-muted-foreground">In unredeemed vouchers</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account List
          </CardTitle>
          <CardDescription>
            Bulk buyer accounts and their voucher balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : accounts?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No accounts yet. Click "Add Account" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Total Vouchers</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Redeemed</TableHead>
                  <TableHead className="text-right">Available Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts?.map((account) => (
                  <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{account.name}</span>
                        {account.notes && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {account.notes}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {account.contactName && (
                          <div className="flex items-center gap-1 text-sm">
                            <User className="h-3 w-3" />
                            {account.contactName}
                          </div>
                        )}
                        {account.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {account.email}
                          </div>
                        )}
                        {account.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {account.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {account.totalVouchers.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="bg-primary/10 text-primary">
                        {account.availableVouchers.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">
                        {account.redeemedVouchers.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(account.availableValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
