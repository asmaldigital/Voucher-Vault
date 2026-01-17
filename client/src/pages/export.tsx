import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, Loader2, CloudUpload, History, RefreshCw, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export default function ExportPage() {
  const [downloading, setDownloading] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [isUploadRestoreOpen, setIsUploadRestoreOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();

  const { data: backups = [], isLoading: backupsLoading } = useQuery<BackupFile[]>({
    queryKey: ['/api/backup/google-drive/list'],
    enabled: isRestoreOpen && isSuperAdmin,
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/backup/google-drive', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Backup failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Backup Successful',
        description: `Successfully backed up data to Google Drive as ${data.fileName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Backup Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch('/api/backup/google-drive/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Restore failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Restore Successful',
        description: 'System data has been restored from the backup.',
      });
      setIsRestoreOpen(false);
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: 'Restore Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const uploadRestoreMutation = useMutation({
    mutationFn: async (backupData: any) => {
      const response = await fetch('/api/backup/upload-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(backupData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Restore failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Restore Successful',
        description: 'System data has been restored from the uploaded backup file.',
      });
      setIsUploadRestoreOpen(false);
      setSelectedFile(null);
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: 'Restore Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadRestore = async () => {
    if (!selectedFile) return;

    try {
      const text = await selectedFile.text();
      const backupData = JSON.parse(text);
      
      if (confirm('Are you absolutely sure? This will replace all current data with the uploaded backup.')) {
        uploadRestoreMutation.mutate(backupData);
      }
    } catch (error) {
      toast({
        title: 'Invalid File',
        description: 'The selected file is not a valid JSON backup file.',
        variant: 'destructive',
      });
    }
  };

  const handleExportAll = async () => {
    setDownloading(true);
    try {
      const url = '/api/exports/all';
      
      const response = await fetch(url, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download export');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `supersave_full_export_${new Date().toISOString().split('T')[0]}.txt`;

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
        description: 'All system data has been exported successfully.',
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
        <h1 className="text-3xl font-bold" data-testid="text-export-title">System Backup</h1>
        <p className="text-muted-foreground">
          Manage your system data with manual exports and Google Drive integration
        </p>
      </div>

      <div className={`grid gap-6 ${isSuperAdmin ? 'md:grid-cols-2' : ''}`}>
        {isSuperAdmin && (
          <Card data-testid="card-export-main" className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudUpload className="h-5 w-5 text-primary" />
                Google Drive Cloud Backup
              </CardTitle>
              <CardDescription>
                Securely back up your data or restore from a previous cloud snapshot.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-muted/50 border space-y-3">
                  <p className="text-sm font-medium">Automatic Cloud Backups</p>
                  <p className="text-sm text-muted-foreground">
                    The system automatically backs up all data to your "SuperSave Backups" folder daily.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => backupMutation.mutate()}
                    disabled={backupMutation.isPending}
                    className="w-full"
                  >
                    {backupMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CloudUpload className="mr-2 h-4 w-4" />
                    )}
                    Run Backup to Drive Now
                  </Button>

                  <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <History className="mr-2 h-4 w-4" />
                        Restore from Google Drive
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Restore from Google Drive</DialogTitle>
                        <DialogDescription>
                          Selecting a backup will OVERWRITE all current system data.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[300px] overflow-y-auto py-4">
                        {backupsLoading ? (
                          <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : backups.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground p-4">
                            No backups found in Google Drive
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {backups.map((backup) => (
                              <div 
                                key={backup.id}
                                className="flex items-center justify-between p-3 rounded-md border bg-muted/50"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium truncate max-w-[200px]">
                                    {backup.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(backup.createdTime).toLocaleString()}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm('Are you absolutely sure? This will replace all current data.')) {
                                      restoreMutation.mutate(backup.id);
                                    }
                                  }}
                                  disabled={restoreMutation.isPending}
                                >
                                  {restoreMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRestoreOpen(false)}>
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isUploadRestoreOpen} onOpenChange={(open) => {
                    setIsUploadRestoreOpen(open);
                    if (!open) setSelectedFile(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full" data-testid="button-upload-restore">
                        <Upload className="mr-2 h-4 w-4" />
                        Restore from Uploaded File
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Restore from Backup File</DialogTitle>
                        <DialogDescription>
                          Upload a JSON backup file to restore system data. This will OVERWRITE all current data.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="backup-file">Select Backup File (.json)</Label>
                          <Input
                            id="backup-file"
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            data-testid="input-backup-file"
                          />
                        </div>
                        {selectedFile && (
                          <div className="p-3 rounded-md border bg-muted/50">
                            <p className="text-sm font-medium">{selectedFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Size: {(selectedFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        )}
                      </div>
                      <DialogFooter className="flex gap-2">
                        <Button variant="ghost" onClick={() => {
                          setIsUploadRestoreOpen(false);
                          setSelectedFile(null);
                        }}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleUploadRestore}
                          disabled={!selectedFile || uploadRestoreMutation.isPending}
                          variant="destructive"
                          data-testid="button-confirm-upload-restore"
                        >
                          {uploadRestoreMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Restore Data
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-export-local" className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Manual CSV Export
            </CardTitle>
            <CardDescription>
              Download a single file containing all system data (vouchers, accounts, and audit logs).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            <div className="p-4 rounded-md bg-muted/50 border space-y-2">
              <p className="text-sm font-medium">Complete Data Export</p>
              <p className="text-sm text-muted-foreground">
                This will generate a comprehensive report including every record in the system across all voucher books and accounts.
              </p>
            </div>
            
            <div className="mt-auto">
              <Button
                onClick={handleExportAll}
                disabled={downloading}
                className="w-full"
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
                    Export Complete System Data
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-export-tips">
        <CardHeader>
          <CardTitle>Backup Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Cloud Security:</strong> Google Drive backups are encrypted and stored in your private folder. Only admins can access the Restore feature.
          </p>
          <p>
            <strong>Local Backups:</strong> CSV exports are useful for offline analysis. We recommend storing these files in a secondary location.
          </p>
          <p>
            <strong>Data Integrity:</strong> Restoring from a backup will completely replace your current system state. Use with caution.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
