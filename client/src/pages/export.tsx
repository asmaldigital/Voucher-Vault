import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, Users, Wallet, History, Receipt, Loader2 } from 'lucide-react';

interface ExportItem {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  icon: typeof FileSpreadsheet;
}

const exports: ExportItem[] = [
  {
    id: 'vouchers',
    title: 'Vouchers',
    description: 'All vouchers with barcode, status, batch, book number, and redemption details',
    endpoint: '/api/exports/vouchers',
    icon: Receipt,
  },
  {
    id: 'accounts',
    title: 'Accounts',
    description: 'Bulk buyer accounts with contact info, purchase totals, and balances',
    endpoint: '/api/exports/accounts',
    icon: Wallet,
  },
  {
    id: 'purchases',
    title: 'Purchases',
    description: 'All account purchase records with amounts, dates, and notes',
    endpoint: '/api/exports/purchases',
    icon: FileSpreadsheet,
  },
  {
    id: 'users',
    title: 'Users',
    description: 'Staff accounts with email, role, and creation date',
    endpoint: '/api/exports/users',
    icon: Users,
  },
  {
    id: 'audit-logs',
    title: 'Audit Logs',
    description: 'Complete activity history with timestamps and details',
    endpoint: '/api/exports/audit-logs',
    icon: History,
  },
];

export default function ExportPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownload = async (exportItem: ExportItem) => {
    setDownloading(exportItem.id);
    try {
      const response = await fetch(exportItem.endpoint, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download export');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `${exportItem.id}_export.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export downloaded',
        description: `${exportItem.title} data has been exported successfully.`,
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold" data-testid="text-export-title">Data Export</h1>
        <p className="text-muted-foreground">
          Download your data as CSV files for backup or analysis in Excel
        </p>
      </div>

      <Card data-testid="card-export-info">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Manual Backup
          </CardTitle>
          <CardDescription>
            Export your data to CSV files that can be opened in Excel or any spreadsheet program.
            These files provide a human-readable backup of all your voucher management data.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exports.map((exportItem) => (
          <Card key={exportItem.id} data-testid={`card-export-${exportItem.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <exportItem.icon className="h-5 w-5" />
                  {exportItem.title}
                </div>
                <Badge variant="secondary">CSV</Badge>
              </CardTitle>
              <CardDescription>{exportItem.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => handleDownload(exportItem)}
                disabled={downloading === exportItem.id}
                data-testid={`button-export-${exportItem.id}`}
              >
                {downloading === exportItem.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download {exportItem.title}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-testid="card-export-tips">
        <CardHeader>
          <CardTitle>Tips for Using Exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Opening in Excel:</strong> Double-click the downloaded .csv file to open it in Excel.
            All columns will be properly formatted and ready for analysis.
          </p>
          <p>
            <strong>Currency Values:</strong> All amounts are shown in South African Rands (ZAR).
            The exports include both the numeric values and formatted currency where applicable.
          </p>
          <p>
            <strong>Regular Backups:</strong> We recommend downloading exports regularly and storing
            them in a safe location like OneDrive or Google Drive for data security.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
