import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, Loader2, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ExportPage() {
  const [downloading, setDownloading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string>('all');
  const { toast } = useToast();

  const { data: bookNumbers = [], isLoading: booksLoading } = useQuery<string[]>({
    queryKey: ['/api/vouchers/books'],
    refetchInterval: 5000,
  });

  const handleExportAll = async () => {
    setDownloading(true);
    try {
      const url = selectedBook === 'all' 
        ? '/api/exports/all' 
        : `/api/exports/all?bookNumber=${encodeURIComponent(selectedBook)}`;
      
      const response = await fetch(url, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download export');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `supersave_export_${new Date().toISOString().split('T')[0]}.txt`;

      const url2 = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url2;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url2);
      document.body.removeChild(a);

      toast({
        title: 'Export downloaded',
        description: selectedBook === 'all' 
          ? 'All data has been exported successfully.'
          : `Data for book ${selectedBook} has been exported successfully.`,
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
            Data Export
          </CardTitle>
          <CardDescription>
            Export vouchers, accounts, purchases, users, and audit logs.
            You can filter by book number or export everything.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter by Book
              </label>
              <Select value={selectedBook} onValueChange={setSelectedBook}>
                <SelectTrigger className="w-full" data-testid="select-book-filter">
                  <SelectValue placeholder="Select a book..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Books</SelectItem>
                  {bookNumbers.map((book) => (
                    <SelectItem key={book} value={book}>
                      {book}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {booksLoading && (
                <p className="text-xs text-muted-foreground">Loading books...</p>
              )}
            </div>
            
            <Button
              size="lg"
              onClick={handleExportAll}
              disabled={downloading}
              className="sm:w-auto"
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
                  {selectedBook === 'all' ? 'Export Everything' : `Export Book ${selectedBook}`}
                </>
              )}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground border-t pt-4">
            <p className="font-medium mb-2">This export includes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Vouchers with barcode, status, and book numbers</li>
              <li>Bulk buyer accounts with contact info and balances</li>
              <li>Purchase and redemption records with amounts and dates</li>
              <li>Staff user accounts and roles</li>
              <li>Complete audit log history</li>
            </ul>
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
