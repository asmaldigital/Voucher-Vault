import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, Loader2, Users, Wallet, Receipt, FileText, BookOpen, MinusCircle } from 'lucide-react';

type ExportType = 'all' | 'vouchers' | 'accounts' | 'purchases' | 'redemptions' | 'users' | 'audit-logs';

export default function ExportPage() {
  const [downloading, setDownloading] = useState<ExportType | null>(null);
  const [bookFilter, setBookFilter] = useState('');
  const { toast } = useToast();

  const handleExport = async (type: ExportType) => {
    setDownloading(type);
    try {
      let url = `/api/exports/${type}`;
      if (type === 'vouchers' && bookFilter.trim()) {
        url += `?bookNumber=${encodeURIComponent(bookFilter.trim())}`;
      }
      
      const response = await fetch(url, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download export');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `supersave_${type}_${new Date().toISOString().split('T')[0]}.csv`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast({
        title: 'Export downloaded',
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} data has been exported successfully.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to download export',
      });
    } finally {
      setDownloading(null);
    }
  };

  const exportOptions = [
    { type: 'vouchers' as ExportType, label: 'Vouchers', icon: FileSpreadsheet, description: 'All vouchers with barcode, status, and book numbers' },
    { type: 'accounts' as ExportType, label: 'Accounts', icon: Wallet, description: 'Bulk buyer accounts with balances' },
    { type: 'purchases' as ExportType, label: 'Purchases', icon: Receipt, description: 'Account purchase records' },
    { type: 'redemptions' as ExportType, label: 'Manual Redemptions', icon: MinusCircle, description: 'Manual fund deductions from accounts' },
    { type: 'users' as ExportType, label: 'Users', icon: Users, description: 'Staff accounts and roles' },
    { type: 'audit-logs' as ExportType, label: 'Audit Logs', icon: FileText, description: 'Complete activity history' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold" data-testid="text-export-title">Data Export</h1>
        <p className="text-muted-foreground">
          Download all your data for backup or analysis
        </p>
      </div>

      <Card data-testid="card-export-main">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Complete Data Export
          </CardTitle>
          <CardDescription>
            Export all data in one file or select individual categories below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            size="lg"
            onClick={() => handleExport('all')}
            disabled={downloading !== null}
            className="w-full sm:w-auto"
            data-testid="button-export-all"
          >
            {downloading === 'all' ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Export Everything
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-voucher-export">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Voucher Export with Book Filter
          </CardTitle>
          <CardDescription>
            Export vouchers for a specific book number
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="book-filter">Book Number (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="book-filter"
                placeholder="e.g., BOOK-001"
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value)}
                className="max-w-xs"
                data-testid="input-book-filter"
              />
              <Button
                onClick={() => handleExport('vouchers')}
                disabled={downloading !== null}
                data-testid="button-export-vouchers"
              >
                {downloading === 'vouchers' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {bookFilter.trim() ? 'Export Book' : 'Export All Vouchers'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to export all vouchers, or enter a book number to filter
            </p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-individual-exports">
        <CardHeader>
          <CardTitle>Individual Exports</CardTitle>
          <CardDescription>
            Download specific data categories as CSV files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exportOptions.filter(opt => opt.type !== 'vouchers').map((option) => (
              <div key={option.type} className="flex flex-col gap-2 p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <option.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{option.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{option.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(option.type)}
                  disabled={downloading !== null}
                  className="mt-2"
                  data-testid={`button-export-${option.type}`}
                >
                  {downloading === option.type ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-export-tips">
        <CardHeader>
          <CardTitle>Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Regular Backups:</strong> We recommend exporting your data regularly and saving the file to a safe location like OneDrive or Google Drive.
          </p>
          <p>
            <strong>File Format:</strong> The export is a plain text file with sections for each data type. You can open it in Notepad, Excel, or any text editor.
          </p>
          <p>
            <strong>Currency Values:</strong> All amounts are shown in South African Rands (ZAR) with proper formatting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
