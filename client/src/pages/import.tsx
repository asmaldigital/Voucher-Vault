import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
} from 'lucide-react';
import type { ImportResult } from '@shared/schema';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [bookNumber, setBookNumber] = useState('');
  const [voucherValue, setVoucherValue] = useState('50');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please upload a CSV file',
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.csv')) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please upload a CSV file',
        });
        return;
      }
      setFile(droppedFile);
      setResult(null);
    }
  };

  const parseCSV = (content: string): string[] => {
    const lines = content.split('\n').filter((line) => line.trim());
    const barcodes: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const firstLine = lines[0].toLowerCase();
      if (i === 0 && (firstLine.includes('barcode') || firstLine.includes('code'))) {
        continue;
      }
      
      const columns = line.split(',');
      const barcode = columns[0].trim().replace(/"/g, '');
      
      if (barcode && barcode.length > 0) {
        barcodes.push(barcode);
      }
    }
    
    return barcodes;
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file || !bookNumber.trim()) {
        throw new Error('Please provide both a file and book number');
      }

      const content = await file.text();
      const barcodes = parseCSV(content);

      if (barcodes.length === 0) {
        throw new Error('No valid barcodes found in the CSV file');
      }

      const value = parseInt(voucherValue) || 50;
      setProgress(50);

      const response = await fetch('/api/vouchers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          barcodes,
          bookNumber: bookNumber.trim(),
          value,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Import failed');
      }

      setProgress(100);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setImporting(false);
      queryClient.invalidateQueries({ queryKey: ['/api/vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      
      if (data.success > 0) {
        toast({
          title: 'Import completed',
          description: `Successfully imported ${data.success} vouchers`,
        });
      }
    },
    onError: (error: Error) => {
      setImporting(false);
      setResult({ success: 0, failed: 0, errors: [error.message] });
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error.message,
      });
    },
  });

  const handleImport = () => {
    if (!file) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a CSV file to import',
      });
      return;
    }
    if (!bookNumber.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a book number',
      });
      return;
    }
    setImporting(true);
    setProgress(0);
    setResult(null);
    importMutation.mutate();
  };

  const handleReset = () => {
    setFile(null);
    setBookNumber('');
    setVoucherValue('50');
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const template = 'barcode\n1234567890123\n1234567890124\n1234567890125';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voucher_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Import Vouchers</h1>
        <p className="text-muted-foreground">
          Bulk import voucher barcodes from a CSV file
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Upload a CSV file containing voucher barcodes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground">
                Drag and drop your CSV file here, or
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-select-file"
              >
                Select File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-file"
              />
            </div>

            {file && (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="flex-1 truncate text-sm" data-testid="text-selected-file">
                  {file.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                  data-testid="button-remove-file"
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="book">Book Number *</Label>
              <Input
                id="book"
                placeholder="e.g., BOOK-001"
                value={bookNumber}
                onChange={(e) => setBookNumber(e.target.value)}
                data-testid="input-book-number"
              />
              <p className="text-xs text-muted-foreground">
                Each book contains 1600 vouchers worth R80,000
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Voucher Value (Rands)</Label>
              <Input
                id="value"
                type="number"
                placeholder="50"
                value={voucherValue}
                onChange={(e) => setVoucherValue(e.target.value)}
                data-testid="input-voucher-value"
              />
            </div>

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-center text-sm text-muted-foreground">
                  Importing... {progress}%
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleImport}
                disabled={!file || !bookNumber.trim() || importing}
                className="flex-1 h-12"
                data-testid="button-import"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Vouchers
                  </>
                )}
              </Button>
              {result && (
                <Button variant="outline" onClick={handleReset} data-testid="button-reset">
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {result && (
            <Card className={result.failed === 0 ? 'border-primary' : 'border-yellow-500'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.failed === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                  )}
                  Import Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-md bg-primary/10 p-4 text-center">
                    <p className="text-3xl font-bold text-primary" data-testid="text-import-success">
                      {result.success}
                    </p>
                    <p className="text-sm text-muted-foreground">Imported</p>
                  </div>
                  <div className="rounded-md bg-destructive/10 p-4 text-center">
                    <p className="text-3xl font-bold text-destructive" data-testid="text-import-failed">
                      {result.failed}
                    </p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">Errors:</p>
                    <div className="max-h-32 overflow-auto rounded-md bg-muted p-3">
                      {result.errors.map((error, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                CSV Template
              </CardTitle>
              <CardDescription>Download a sample CSV template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your CSV file should contain voucher barcodes in the first column.
                The first row can optionally be a header row.
              </p>
              <div className="rounded-md bg-muted p-3 font-mono text-sm">
                <p>barcode</p>
                <p>1234567890123</p>
                <p>1234567890124</p>
                <p>1234567890125</p>
              </div>
              <Button variant="outline" onClick={downloadTemplate} className="w-full" data-testid="button-download-template">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
