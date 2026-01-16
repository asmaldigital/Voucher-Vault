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
import { Wallet, Plus, User, Mail, Phone, FileText, Loader2, DollarSign, TrendingUp, History, MinusCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { AccountSummary, AccountPurchase, AccountActivity } from '@shared/schema';

const accountFormSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  contactName: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountFormSchema>;

const purchaseFormSchema = z.object({
  amountRands: z.coerce.number()
    .min(50, 'Minimum purchase is R50')
    .refine((val) => val % 50 === 0, 'Amount must be a multiple of R50 (e.g., R50, R100, R150)'),
  notes: z.string().optional(),
});

type PurchaseFormData = z.infer<typeof purchaseFormSchema>;

const redemptionFormSchema = z.object({
  amountRands: z.coerce.number().min(1, 'Amount is required'),
  redemptionDate: z.string().optional(),
  redemptionTime: z.string().optional(),
  notes: z.string().optional(),
});

type RedemptionFormData = z.infer<typeof redemptionFormSchema>;

export default function AccountsPage() {
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isRedemptionDialogOpen, setIsRedemptionDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: '',
      contactName: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  const purchaseForm = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      amountRands: 1000,
      notes: '',
    },
  });

  const redemptionForm = useForm<RedemptionFormData>({
    resolver: zodResolver(redemptionFormSchema),
    defaultValues: {
      amountRands: 0,
      redemptionDate: new Date().toISOString().split('T')[0],
      redemptionTime: new Date().toTimeString().slice(0, 5),
      notes: '',
    },
  });

  const { data: accounts, isLoading } = useQuery<AccountSummary[]>({
    queryKey: ['/api/accounts/summaries'],
  });

  const { data: activity, isLoading: activityLoading } = useQuery<AccountActivity[]>({
    queryKey: ['/api/accounts', selectedAccountId, 'activity'],
    enabled: !!selectedAccountId && isHistoryDialogOpen,
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      const response = await apiRequest('POST', '/api/accounts', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts/summaries'] });
      setIsAccountDialogOpen(false);
      accountForm.reset();
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

  const createPurchaseMutation = useMutation({
    mutationFn: async (data: PurchaseFormData) => {
      const response = await apiRequest('POST', `/api/accounts/${selectedAccountId}/purchases`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts/summaries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', selectedAccountId, 'purchases'] });
      setIsPurchaseDialogOpen(false);
      purchaseForm.reset();
      toast({
        title: 'Receipt recorded',
        description: 'The funds received have been recorded successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to record receipt',
        description: error.message,
      });
    },
  });

  const createRedemptionMutation = useMutation({
    mutationFn: async (data: RedemptionFormData) => {
      const response = await apiRequest('POST', `/api/accounts/${selectedAccountId}/redemptions`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts/summaries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts', selectedAccountId, 'activity'] });
      setIsRedemptionDialogOpen(false);
      redemptionForm.reset();
      toast({
        title: 'Redemption recorded',
        description: 'The manual redemption has been recorded successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to record redemption',
        description: error.message,
      });
    },
  });

  const onSubmitAccount = (data: AccountFormData) => {
    createAccountMutation.mutate(data);
  };

  const onSubmitPurchase = (data: PurchaseFormData) => {
    createPurchaseMutation.mutate(data);
  };

  const onSubmitRedemption = (data: RedemptionFormData) => {
    createRedemptionMutation.mutate(data);
  };

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  const openPurchaseDialog = (accountId: string) => {
    setSelectedAccountId(accountId);
    purchaseForm.reset({ amountRands: 1000, notes: '' });
    setIsPurchaseDialogOpen(true);
  };

  const openRedemptionDialog = (accountId: string) => {
    setSelectedAccountId(accountId);
    redemptionForm.reset({
      amountRands: 0,
      redemptionDate: new Date().toISOString().split('T')[0],
      redemptionTime: new Date().toTimeString().slice(0, 5),
      notes: '',
    });
    setIsRedemptionDialogOpen(true);
  };

  const openHistoryDialog = (accountId: string) => {
    setSelectedAccountId(accountId);
    setIsHistoryDialogOpen(true);
  };

  const handleAccountDialogChange = (open: boolean) => {
    setIsAccountDialogOpen(open);
    if (!open) {
      accountForm.reset();
    }
  };

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);

  const totalStats = accounts?.reduce(
    (acc, account) => ({
      totalReceived: acc.totalReceived + account.totalReceived,
      totalRedeemed: acc.totalRedeemed + account.totalRedeemed,
      manualRedemptions: acc.manualRedemptions + account.manualRedemptions,
      remainingBalance: acc.remainingBalance + account.remainingBalance,
      accountCount: acc.accountCount + 1,
    }),
    { totalReceived: 0, totalRedeemed: 0, manualRedemptions: 0, remainingBalance: 0, accountCount: 0 }
  ) || { totalReceived: 0, totalRedeemed: 0, manualRedemptions: 0, remainingBalance: 0, accountCount: 0 };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-accounts-title">Accounts</h1>
          <p className="text-muted-foreground">
            Manage bulk buyer accounts and track their fund receipts
          </p>
        </div>
        <Dialog open={isAccountDialogOpen} onOpenChange={handleAccountDialogChange}>
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
                Add a new account for tracking bulk voucher fund receipts
              </DialogDescription>
            </DialogHeader>
            <Form {...accountForm}>
              <form onSubmit={accountForm.handleSubmit(onSubmitAccount)} className="space-y-4">
                <FormField
                  control={accountForm.control}
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
                  control={accountForm.control}
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
                    control={accountForm.control}
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
                    control={accountForm.control}
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
                  control={accountForm.control}
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
                    onClick={() => handleAccountDialogChange(false)}
                    data-testid="button-cancel-account"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAccountMutation.isPending} data-testid="button-save-account">
                    {createAccountMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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

        <Card data-testid="card-total-received">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-received">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalStats.totalReceived)}
            </div>
            <p className="text-xs text-muted-foreground">All account fund receipts</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-redeemed">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Redeemed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-redeemed">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalStats.totalRedeemed)}
            </div>
            <p className="text-xs text-muted-foreground">Vouchers used</p>
          </CardContent>
        </Card>

        <Card data-testid="card-remaining-balance">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Balance</CardTitle>
            <Badge variant="secondary">ZAR</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-remaining-balance">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalStats.remainingBalance)}
            </div>
            <p className="text-xs text-muted-foreground">Available to redeem</p>
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
            Bulk buyer accounts with receipt tracking and balances
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
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right font-medium" data-testid={`text-purchased-${account.id}`}>
                      {formatCurrency(account.totalReceived)}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-redeemed-${account.id}`}>
                      {formatCurrency(account.totalRedeemed + account.manualRedemptions)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={account.remainingBalance > 0 ? "default" : "secondary"}
                        data-testid={`badge-balance-${account.id}`}
                      >
                        {formatCurrency(account.remainingBalance)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openHistoryDialog(account.id)}
                          data-testid={`button-history-${account.id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRedemptionDialog(account.id)}
                          data-testid={`button-add-redemption-${account.id}`}
                        >
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openPurchaseDialog(account.id)}
                          data-testid={`button-add-purchase-${account.id}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Receipt</DialogTitle>
            <DialogDescription>
              Record funds received for {selectedAccount?.name}
            </DialogDescription>
          </DialogHeader>
          <Form {...purchaseForm}>
            <form onSubmit={purchaseForm.handleSubmit(onSubmitPurchase)} className="space-y-4">
              <FormField
                control={purchaseForm.control}
                name="amountRands"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (Rands) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={50}
                        step={50}
                        placeholder="e.g., 1000"
                        data-testid="input-purchase-amount"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      = {Math.floor((field.value || 0) / 50)} vouchers at R50 each
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={purchaseForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Invoice #12345"
                        data-testid="input-purchase-notes"
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
                  onClick={() => setIsPurchaseDialogOpen(false)}
                  data-testid="button-cancel-purchase"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createPurchaseMutation.isPending} data-testid="button-save-receipt">
                  {createPurchaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Receipt
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Redemption Dialog */}
      <Dialog open={isRedemptionDialogOpen} onOpenChange={setIsRedemptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Manual Redemption</DialogTitle>
            <DialogDescription>
              Deduct funds from {selectedAccount?.name}'s balance
            </DialogDescription>
          </DialogHeader>
          <Form {...redemptionForm}>
            <form onSubmit={redemptionForm.handleSubmit(onSubmitRedemption)} className="space-y-4">
              <FormField
                control={redemptionForm.control}
                name="amountRands"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (Rands) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g., 500"
                        data-testid="input-redemption-amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={redemptionForm.control}
                  name="redemptionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-redemption-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={redemptionForm.control}
                  name="redemptionTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          data-testid="input-redemption-time"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={redemptionForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Cash withdrawal, Petty cash"
                        data-testid="input-redemption-notes"
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
                  onClick={() => setIsRedemptionDialogOpen(false)}
                  data-testid="button-cancel-redemption"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createRedemptionMutation.isPending} data-testid="button-save-redemption">
                  {createRedemptionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Redemption
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Activity History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Account Activity</DialogTitle>
            <DialogDescription>
              Full activity history for {selectedAccount?.name}
            </DialogDescription>
          </DialogHeader>
          {activityLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activity?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground" data-testid="text-no-activity">
              No activity recorded yet.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table data-testid="table-activity">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity?.map((item) => (
                    <TableRow key={item.id} data-testid={`row-activity-${item.id}`}>
                      <TableCell data-testid={`text-activity-date-${item.id}`}>
                        {format(new Date(item.date), 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={item.type === 'purchase' ? 'default' : item.type === 'manual_redemption' ? 'destructive' : 'secondary'}
                          data-testid={`badge-activity-type-${item.id}`}
                        >
                          {item.type === 'purchase' ? 'Received' : item.type === 'manual_redemption' ? 'Manual Deduct' : 'Voucher Used'}
                        </Badge>
                      </TableCell>
                      <TableCell 
                        className={`text-right font-medium ${item.type === 'purchase' ? 'text-green-600' : 'text-red-600'}`}
                        data-testid={`text-activity-amount-${item.id}`}
                      >
                        {item.type === 'purchase' ? '+' : '-'}{formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate" data-testid={`text-activity-notes-${item.id}`}>
                        {item.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsHistoryDialogOpen(false)}
              data-testid="button-close-history"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
