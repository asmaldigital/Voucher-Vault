import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { db } from './db';
import { vouchers, users, accounts, accountPurchases, accountRedemptions, auditLogs, passwordResetTokens } from '@shared/schema';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Google Drive connection not available. Please connect Google Drive in the Integrations panel.');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

export async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function getOrCreateBackupFolder(drive: any) {
  const response = await drive.files.list({
    q: "name = 'SuperSave Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id)',
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  const fileMetadata = {
    name: 'SuperSave Backups',
    mimeType: 'application/vnd.google-apps.folder',
  };

  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
  });

  return folder.data.id;
}

export async function runFullBackup() {
  try {
    const drive = await getUncachableGoogleDriveClient();
    const folderId = await getOrCreateBackupFolder(drive);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `SuperSave_Backup_${timestamp}.json`;

    const [
      allVouchers,
      allUsers,
      allAccounts,
      allPurchases,
      allRedemptions,
      allLogs
    ] = await Promise.all([
      db.select().from(vouchers),
      db.select().from(users),
      db.select().from(accounts),
      db.select().from(accountPurchases),
      db.select().from(accountRedemptions),
      db.select().from(auditLogs)
    ]);

    const backupData = {
      timestamp,
      vouchers: allVouchers,
      users: allUsers,
      accounts: allAccounts,
      purchases: allPurchases,
      manualRedemptions: allRedemptions,
      auditLogs: allLogs,
      version: "1.0"
    };

    const buffer = Buffer.from(JSON.stringify(backupData, null, 2));
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    await drive.files.create({
      requestBody: {
        name: backupName,
        parents: [folderId],
      },
      media: {
        mimeType: 'application/json',
        body: stream,
      },
    });

    console.log(`Successfully backed up everything to Google Drive: ${backupName}`);
    return { success: true, fileName: backupName };
  } catch (error: any) {
    console.error('Backup to Google Drive failed:', error.message);
    throw error;
  }
}

export async function restoreFromBackup(fileId: string) {
  try {
    const drive = await getUncachableGoogleDriveClient();
    
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    });

    const backupData: any = response.data;
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Invalid backup data format');
    }

    await db.transaction(async (tx) => {
      await tx.delete(auditLogs);
      await tx.delete(passwordResetTokens);
      await tx.delete(accountRedemptions);
      await tx.delete(accountPurchases);
      await tx.delete(vouchers);
      await tx.delete(accounts);
      await tx.delete(users);

      const prepareData = (data: any[]) => {
        return data.map(item => {
          const newItem = { ...item };
          for (const key in newItem) {
            if (newItem[key] && typeof newItem[key] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(newItem[key])) {
              newItem[key] = new Date(newItem[key]);
            }
          }
          return newItem;
        });
      };

      if (backupData.users?.length > 0) {
        await tx.insert(users).values(prepareData(backupData.users));
      }
      if (backupData.accounts?.length > 0) {
        await tx.insert(accounts).values(prepareData(backupData.accounts));
      }
      if (backupData.vouchers?.length > 0) {
        await tx.insert(vouchers).values(prepareData(backupData.vouchers));
      }
      if (backupData.purchases?.length > 0) {
        await tx.insert(accountPurchases).values(prepareData(backupData.purchases));
      }
      if (backupData.manualRedemptions?.length > 0) {
        await tx.insert(accountRedemptions).values(prepareData(backupData.manualRedemptions));
      }
      if (backupData.auditLogs?.length > 0) {
        await tx.insert(auditLogs).values(prepareData(backupData.auditLogs));
      }
    });

    console.log(`Successfully restored data from Google Drive backup: ${fileId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Restore from Google Drive failed:', error.message);
    throw error;
  }
}

export async function listBackups() {
  try {
    const drive = await getUncachableGoogleDriveClient();
    const folderId = await getOrCreateBackupFolder(drive);
    
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, createdTime, size)',
      orderBy: 'createdTime desc',
    });

    return response.data.files;
  } catch (error: any) {
    console.error('Failed to list backups:', error.message);
    throw error;
  }
}
