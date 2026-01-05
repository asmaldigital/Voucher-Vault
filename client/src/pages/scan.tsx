import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import type { RedemptionResult } from '@shared/schema';

export default function ScanPage() {
  const [barcode, setBarcode] = useState('');
  const [result, setResult] = useState<RedemptionResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const redeemMutation = useMutation({
    mutationFn: async (barcodeValue: string) => {
      const response = await fetch('/api/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ barcode: barcodeValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Redemption failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers'] });
      
      if (data.success) {
        toast({
          title: 'Voucher Redeemed',
          description: data.message,
        });
      }
    },
    onError: (error: Error) => {
      setResult({
        success: false,
        message: error.message || 'An error occurred while redeeming the voucher',
      });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a barcode',
      });
      return;
    }
    redeemMutation.mutate(barcode.trim());
  };

  const handleReset = () => {
    setBarcode('');
    setResult(null);
    inputRef.current?.focus();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Scan & Redeem</h1>
        <p className="text-muted-foreground">
          Enter or scan a voucher barcode to redeem it
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5" />
              Voucher Scanner
            </CardTitle>
            <CardDescription>
              Type the barcode or use a barcode scanner
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter barcode..."
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="h-16 text-center font-mono text-2xl"
                  autoComplete="off"
                  data-testid="input-barcode"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="h-14 flex-1 text-lg"
                  disabled={redeemMutation.isPending || !barcode.trim()}
                  data-testid="button-redeem"
                >
                  {redeemMutation.isPending ? (
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
                {result && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14"
                    onClick={handleReset}
                    data-testid="button-scan-again"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Scan Again
                  </Button>
                )}
              </div>
            </form>

            {result && (
              <Card
                className={
                  result.success
                    ? 'border-primary bg-primary/5'
                    : 'border-destructive bg-destructive/5'
                }
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-4 text-center">
                    {result.success ? (
                      <CheckCircle2 className="h-16 w-16 text-primary" />
                    ) : result.voucher?.status === 'redeemed' ? (
                      <AlertCircle className="h-16 w-16 text-yellow-600 dark:text-yellow-500" />
                    ) : (
                      <XCircle className="h-16 w-16 text-destructive" />
                    )}
                    
                    <div className="space-y-2">
                      <h3
                        className={`text-xl font-semibold ${
                          result.success ? 'text-primary' : 'text-destructive'
                        }`}
                        data-testid="text-result-title"
                      >
                        {result.success ? 'Success!' : 'Cannot Redeem'}
                      </h3>
                      <p className="text-muted-foreground" data-testid="text-result-message">
                        {result.message}
                      </p>
                    </div>

                    {result.voucher && (
                      <div className="w-full rounded-md bg-background p-4">
                        <div className="grid gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Value:</span>
                            <span className="font-mono font-semibold" data-testid="text-voucher-value">
                              R{result.voucher.value}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Batch:</span>
                            <span className="font-mono" data-testid="text-voucher-batch">
                              {result.voucher.batchNumber}
                            </span>
                          </div>
                          {result.redeemedBy && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Redeemed by:</span>
                              <span data-testid="text-redeemed-by">{result.redeemedBy}</span>
                            </div>
                          )}
                          {result.redeemedAt && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Redeemed at:</span>
                              <span data-testid="text-redeemed-at">
                                {formatDate(result.redeemedAt)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
