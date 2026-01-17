import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

export default function ExportPage() {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const handleExportAll = async () => {
    setDownloading(true);
    try {
      const response = await fetch('/api/exports/all', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download export');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `supersave_export_${new Date().toISOString().split('T')[0]}.txt`;

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
        description: 'All data has been exported successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to download export',
      });
    } finally {
      setDownloading(false);
    }
  };

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
            Export all vouchers, accounts, purchases, users, and audit logs in one file.
            The export includes all data formatted for easy reading and can be opened in any text editor or spreadsheet program.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">This export includes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All vouchers with barcode, status, batch, and book numbers</li>
              <li>Bulk buyer accounts with contact info and balances</li>
              <li>Purchase records with amounts and dates</li>
              <li>Staff user accounts and roles</li>
              <li>Complete audit log history</li>
            </ul>
          </div>
          
          <Button
            size="lg"
            onClick={handleExportAll}
            disabled={downloading}
            className="w-full sm:w-auto"
            data-testid="button-export-all"
          >
            {downloading ? (
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
