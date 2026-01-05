import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useSupabase } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ScanBarcode,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import type { Voucher, RedemptionResult } from '@shared/schema';

type ScanState = 'idle' | 'loading' | 'success' | 'error' | 'not-found' | 'already-redeemed';

interface RedemptionInfo {
  voucher?: Voucher;
  message: string;
  redeemedBy?: string;
  redeemedAt?: string;
}

export default function ScanPage() {
  const [barcode, setBarcode] = useState('');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [redemptionInfo, setRedemptionInfo] = useState<RedemptionInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const redeemMutation = useMutation({
    mutationFn: async (barcodeValue: string): Promise<RedemptionResult> => {
      if (!supabase) {
        return { success: false, message: 'System not ready. Please try again.' };
      }
      
      const { data: voucher, error: fetchError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('barcode', barcodeValue.trim())
        .single();

      if (fetchError || !voucher) {
        return {
          success: false,
          message: 'Voucher not found. Please check the barcode and try again.',
        };
      }

      if (voucher.status === 'redeemed') {
        return {
          success: false,
          message: 'This voucher has already been redeemed.',
          voucher,
          redeemedBy: voucher.redeemed_by_email || voucher.redeemed_by || 'Unknown',
          redeemedAt: voucher.redeemed_at,
        };
      }

      if (voucher.status === 'expired') {
        return {
          success: false,
          message: 'This voucher has expired and cannot be redeemed.',
          voucher,
        };
      }

      if (voucher.status === 'voided') {
        return {
          success: false,
          message: 'This voucher has been voided and cannot be redeemed.',
          voucher,
        };
      }

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('vouchers')
        .update({
          status: 'redeemed',
          redeemed_at: now,
          redeemed_by: user?.id,
          redeemed_by_email: user?.email,
        })
        .eq('id', voucher.id)
        .eq('status', 'available');

      if (updateError) {
        return {
          success: false,
          message: 'Failed to redeem voucher. Please try again.',
        };
      }

      await supabase.from('audit_log').insert({
        action: 'redeemed',
        voucher_id: voucher.id,
        user_id: user?.id,
        details: { barcode: barcodeValue, value: voucher.value },
      });

      return {
        success: true,
        message: `Voucher R${voucher.value} redeemed successfully!`,
        voucher: { ...voucher, status: 'redeemed', redeemed_at: now },
      };
    },
    onSuccess: (result) => {
      if (result.success) {
        setScanState('success');
        setRedemptionInfo({
          voucher: result.voucher,
          message: result.message,
        });
        toast({
          title: 'Success!',
          description: result.message,
        });
      } else if (result.redeemedAt) {
        setScanState('already-redeemed');
        setRedemptionInfo({
          voucher: result.voucher,
          message: result.message,
          redeemedBy: result.redeemedBy,
          redeemedAt: result.redeemedAt,
        });
      } else if (result.voucher) {
        setScanState('error');
        setRedemptionInfo({
          voucher: result.voucher,
          message: result.message,
        });
      } else {
        setScanState('not-found');
        setRedemptionInfo({
          message: result.message,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers'] });
    },
    onError: () => {
      setScanState('error');
      setRedemptionInfo({
        message: 'An unexpected error occurred. Please try again.',
      });
    },
  });

  const handleScan = () => {
    if (!barcode.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a barcode',
      });
      return;
    }
    setScanState('loading');
    redeemMutation.mutate(barcode);
  };

  const handleReset = () => {
    setBarcode('');
    setScanState('idle');
    setRedemptionInfo(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcode.trim()) {
      handleScan();
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Scan & Redeem</h1>
          <p className="mt-2 text-muted-foreground">
            Enter or scan a voucher barcode to redeem it
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5" />
              Enter Barcode
            </CardTitle>
            <CardDescription>
              Type the barcode number or use a scanner
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                placeholder="Enter voucher barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={scanState === 'loading'}
                className="h-14 font-mono text-xl"
                data-testid="input-barcode"
              />
            </div>
            <Button
              onClick={handleScan}
              disabled={!barcode.trim() || scanState === 'loading'}
              className="h-14 w-full text-lg"
              data-testid="button-redeem"
            >
              {scanState === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ScanBarcode className="mr-2 h-5 w-5" />
                  Redeem Voucher
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {scanState === 'success' && redemptionInfo && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-primary">Redemption Successful!</h3>
                  <p className="mt-2 font-mono text-3xl font-bold" data-testid="text-redemption-value">
                    R{redemptionInfo.voucher?.value ?? 50}
                  </p>
                </div>
                <div className="w-full rounded-md bg-background p-3">
                  <p className="font-mono text-lg" data-testid="text-redeemed-barcode">
                    {redemptionInfo.voucher?.barcode}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Batch: {redemptionInfo.voucher?.batch_number}
                  </p>
                </div>
                <Button onClick={handleReset} className="mt-2 h-12 w-full" data-testid="button-scan-another">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Scan Another Voucher
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {scanState === 'already-redeemed' && redemptionInfo && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-destructive">Already Redeemed</h3>
                  <p className="mt-2 text-muted-foreground">
                    This voucher has already been used
                  </p>
                </div>
                <div className="w-full space-y-2 rounded-md bg-background p-4 text-left">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Barcode:</span>
                    <span className="font-mono" data-testid="text-error-barcode">{redemptionInfo.voucher?.barcode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Redeemed by:</span>
                    <span data-testid="text-redeemed-by">{redemptionInfo.redeemedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Redeemed at:</span>
                    <span data-testid="text-redeemed-at">{formatDate(redemptionInfo.redeemedAt)}</span>
                  </div>
                </div>
                <Button onClick={handleReset} variant="outline" className="mt-2 h-12 w-full" data-testid="button-try-again">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Try Another Barcode
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {scanState === 'not-found' && redemptionInfo && (
          <Card className="border-yellow-500 bg-yellow-500/5">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
                  <AlertCircle className="h-10 w-10 text-yellow-600 dark:text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-yellow-600 dark:text-yellow-500">Voucher Not Found</h3>
                  <p className="mt-2 text-muted-foreground">
                    {redemptionInfo.message}
                  </p>
                </div>
                <div className="w-full rounded-md bg-background p-3">
                  <p className="font-mono text-lg" data-testid="text-searched-barcode">{barcode}</p>
                </div>
                <Button onClick={handleReset} variant="outline" className="mt-2 h-12 w-full" data-testid="button-try-again-not-found">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Try Another Barcode
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {scanState === 'error' && redemptionInfo && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-destructive">Error</h3>
                  <p className="mt-2 text-muted-foreground">
                    {redemptionInfo.message}
                  </p>
                </div>
                <Button onClick={handleReset} variant="outline" className="mt-2 h-12 w-full" data-testid="button-try-again-error">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
