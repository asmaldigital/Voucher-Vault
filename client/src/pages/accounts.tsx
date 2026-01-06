import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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

const accountFormSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  contactName: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountFormSchema>;

export default function AccountsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: '',
      contactName: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  const { data: accounts, isLoading } = useQuery<AccountWithStats[]>({
    queryKey: ['/api/accounts'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      const response = await apiRequest('POST', '/api/accounts', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      setIsDialogOpen(false);
      form.reset();
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

  const onSubmit = (data: AccountFormData) => {
    createMutation.mutate(data);
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

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      form.reset();
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-accounts-title">Accounts</h1>
          <p className="text-muted-foreground">
            Manage bulk buyer accounts and their voucher allocations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., ABC Corporation"
                          data-testid="input-account-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., John Smith"
                          data-testid="input-contact-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@company.co.za"
                            data-testid="input-account-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+27 82 123 4567"
                            data-testid="input-account-phone"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional information..."
                          data-testid="input-account-notes"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogChange(false)}
                    data-testid="button-cancel-account"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-account">
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-accounts">
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

        <Card data-testid="card-total-vouchers">
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

        <Card data-testid="card-available-value">
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

      <Card data-testid="card-account-list">
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
            <div className="py-8 text-center text-muted-foreground" data-testid="text-no-accounts">
              No accounts yet. Click "Add Account" to create one.
            </div>
          ) : (
            <Table data-testid="table-accounts">
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
                        <span className="font-medium" data-testid={`text-account-name-${account.id}`}>
                          {account.name}
                        </span>
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
                            <span data-testid={`text-contact-${account.id}`}>{account.contactName}</span>
                          </div>
                        )}
                        {account.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span data-testid={`text-email-${account.id}`}>{account.email}</span>
                          </div>
                        )}
                        {account.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span data-testid={`text-phone-${account.id}`}>{account.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium" data-testid={`text-total-vouchers-${account.id}`}>
                      {account.totalVouchers.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="bg-primary/10 text-primary" data-testid={`badge-available-${account.id}`}>
                        {account.availableVouchers.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" data-testid={`badge-redeemed-${account.id}`}>
                        {account.redeemedVouchers.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium" data-testid={`text-available-value-${account.id}`}>
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
