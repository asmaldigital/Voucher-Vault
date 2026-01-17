import { Octokit } from '@octokit/rest'
import * as fs from 'fs';
import * as path from 'path';

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
    throw new Error('GitHub connection not available. Please connect GitHub in the Integrations panel.');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected. Please connect GitHub in the Integrations panel.');
  }
  return accessToken;
}

export async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

// Use an ALLOWLIST approach - only backup specific directories/files we know are safe
const ALLOWED_DIRECTORIES = [
  'client',
  'server', 
  'shared',
];

const ALLOWED_ROOT_FILES = [
  'package.json',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'vite.config.ts',
  'drizzle.config.ts',
  'replit.md',
  'design_guidelines.md',
];

// Additional patterns to exclude even from allowed directories
const ALWAYS_EXCLUDE = [
  '.env',
  '.pem',
  '.key',
  '.pfx',
  '.p12',
  '.sqlite',
  '.db',
  'secrets',
  'credentials',
  '.npmrc',
];

function shouldIncludeFile(relativePath: string, filename: string): boolean {
  // Check if file matches exclusion patterns
  for (const pattern of ALWAYS_EXCLUDE) {
    if (filename.includes(pattern) || relativePath.includes(pattern)) {
      return false;
    }
  }
  
  // Check if it's an allowed root file
  if (!relativePath.includes('/') && ALLOWED_ROOT_FILES.includes(filename)) {
    return true;
  }
  
  // Check if it's in an allowed directory
  for (const dir of ALLOWED_DIRECTORIES) {
    if (relativePath.startsWith(dir + '/') || relativePath === dir) {
      return true;
    }
  }
  
  return false;
}

// Get files to backup using allowlist approach
function getFilesToBackup(dir: string, baseDir: string = dir): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        // Only recurse into allowed directories
        if (ALLOWED_DIRECTORIES.some(d => relativePath === d || relativePath.startsWith(d + '/'))) {
          files.push(...getFilesToBackup(fullPath, baseDir));
        }
      } else if (entry.isFile()) {
        // Check if file should be included
        if (shouldIncludeFile(relativePath, entry.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // Skip binary files and very large files (> 500KB)
            if (content.length < 500000 && !content.includes('\0')) {
              files.push({ path: relativePath, content });
            }
          } catch (e) {
            // Skip files that can't be read
          }
        }
      }
    }
  } catch (e) {
    // Skip directories that can't be read
  }
  
  return files;
}

// Sensitive file patterns that should never be backed up
const SENSITIVE_PATTERNS = [
  /\.env/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /secret/i,
  /credential/i,
  /password/i,
  /\.sqlite$/i,
  /\.db$/i,
  /api[_-]?key/i,
  /token\.json$/i,
  /service[_-]?account/i,
];

function scanForSensitiveFiles(files: { path: string; content: string }[]): string[] {
  const sensitiveFiles: string[] = [];
  for (const file of files) {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(file.path)) {
        sensitiveFiles.push(file.path);
        break;
      }
    }
  }
  return sensitiveFiles;
}

export async function backupToGithub(repoName: string, isPrivate: boolean = true) {
  const octokit = await getUncachableGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  
  let defaultBranch = 'main';
  
  // Try to get repo, create if doesn't exist
  try {
    const { data: repo } = await octokit.repos.get({
      owner: user.login,
      repo: repoName,
    });
    defaultBranch = repo.default_branch;
  } catch (e: any) {
    if (e.status === 404) {
      // Create repo if it doesn't exist
      const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: isPrivate,
        description: 'Automated backup of SuperSave Voucher Management System',
        auto_init: true,
      });
      defaultBranch = newRepo.default_branch || 'main';
      // Wait for repo to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      throw e;
    }
  }

  // Get all files to backup
  const files = getFilesToBackup(process.cwd());
  
  if (files.length === 0) {
    throw new Error('No files found to backup');
  }

  // Security check: scan for sensitive files and abort if found
  const sensitiveFiles = scanForSensitiveFiles(files);
  if (sensitiveFiles.length > 0) {
    throw new Error(`Security check failed: Found potentially sensitive files: ${sensitiveFiles.slice(0, 3).join(', ')}${sensitiveFiles.length > 3 ? '...' : ''}. Backup aborted.`);
  }

  // Get the current commit SHA
  let latestCommitSha: string;
  try {
    const { data: ref } = await octokit.git.getRef({
      owner: user.login,
      repo: repoName,
      ref: `heads/${defaultBranch}`,
    });
    latestCommitSha = ref.object.sha;
  } catch (e: any) {
    if (e.status === 409 || e.status === 404) {
      // Repository is empty or branch doesn't exist, create initial commit
      const { data: blob } = await octokit.git.createBlob({
        owner: user.login,
        repo: repoName,
        content: Buffer.from('# SuperSave Voucher System Backup\n\nThis repository contains automated backups.').toString('base64'),
        encoding: 'base64',
      });

      const { data: tree } = await octokit.git.createTree({
        owner: user.login,
        repo: repoName,
        tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: blob.sha }],
      });

      const { data: commit } = await octokit.git.createCommit({
        owner: user.login,
        repo: repoName,
        message: 'Initial commit',
        tree: tree.sha,
        parents: [],
      });

      try {
        await octokit.git.createRef({
          owner: user.login,
          repo: repoName,
          ref: `refs/heads/${defaultBranch}`,
          sha: commit.sha,
        });
      } catch {
        // Ref might already exist
      }

      latestCommitSha = commit.sha;
    } else {
      throw e;
    }
  }

  // Get the tree of the latest commit
  const { data: latestCommit } = await octokit.git.getCommit({
    owner: user.login,
    repo: repoName,
    commit_sha: latestCommitSha,
  });

  // Create blobs for each file
  const treeItems: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = [];
  
  for (const file of files) {
    const { data: blob } = await octokit.git.createBlob({
      owner: user.login,
      repo: repoName,
      content: Buffer.from(file.content).toString('base64'),
      encoding: 'base64',
    });
    
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }

  // Create a new tree
  const { data: newTree } = await octokit.git.createTree({
    owner: user.login,
    repo: repoName,
    tree: treeItems,
    base_tree: latestCommit.tree.sha,
  });

  // Create a new commit
  const timestamp = new Date().toISOString();
  const { data: newCommit } = await octokit.git.createCommit({
    owner: user.login,
    repo: repoName,
    message: `Backup from SuperSave - ${timestamp}`,
    tree: newTree.sha,
    parents: [latestCommitSha],
  });

  // Update the reference
  await octokit.git.updateRef({
    owner: user.login,
    repo: repoName,
    ref: `heads/${defaultBranch}`,
    sha: newCommit.sha,
  });

  return { 
    owner: user.login, 
    repo: repoName,
    filesBackedUp: files.length,
    commitSha: newCommit.sha,
    message: `Successfully backed up ${files.length} files`
  };
}
