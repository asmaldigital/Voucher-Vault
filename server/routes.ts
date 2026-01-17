import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { createUserSchema, loginSchema, insertVoucherSchema, users, type Voucher, type AccountSummary, type AccountPurchase, type User, type AuditLog } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

// CSV generation helpers
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function formatCurrency(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

function generateVouchersCsv(vouchers: Voucher[]): string {
  const headers = ['Barcode', 'Value (Rands)', 'Status', 'Batch Number', 'Book Number', 'Account ID', 'Created At', 'Redeemed At', 'Redeemed By'];
  const rows = vouchers.map(v => [
    escapeCsvField(v.barcode),
    v.value,
    escapeCsvField(v.status),
    escapeCsvField(v.batchNumber),
    escapeCsvField(v.bookNumber),
    escapeCsvField(v.accountId),
    escapeCsvField(formatDate(v.createdAt)),
    escapeCsvField(formatDate(v.redeemedAt)),
    escapeCsvField(v.redeemedByEmail)
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

function generateAccountsCsv(accounts: AccountSummary[]): string {
  const headers = ['Name', 'Contact Name', 'Email', 'Phone', 'Total Purchased (Rands)', 'Total Allocated (Rands)', 'Total Redeemed (Rands)', 'Remaining Balance (Rands)', 'Vouchers Purchased', 'Vouchers Allocated', 'Vouchers Redeemed', 'Notes'];
  const rows = accounts.map(a => [
    escapeCsvField(a.name),
    escapeCsvField(a.contactName),
    escapeCsvField(a.email),
    escapeCsvField(a.phone),
    a.totalPurchased,
    a.totalAllocated,
    a.totalRedeemed,
    a.remainingBalance,
    a.vouchersPurchased,
    a.vouchersAllocated,
    a.vouchersRedeemed,
    escapeCsvField(a.notes)
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

function generatePurchasesCsv(purchases: AccountPurchase[], accountMap: Map<string, string>): string {
  const headers = ['Account Name', 'Amount (Rands)', 'Voucher Count', 'Purchase Date', 'Notes'];
  const rows = purchases.map(p => [
    escapeCsvField(accountMap.get(p.accountId) || 'Unknown'),
    (p.amountCents / 100).toFixed(2),
    p.voucherCount,
    escapeCsvField(formatDate(p.purchaseDate)),
    escapeCsvField(p.notes)
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

function generateUsersCsv(users: User[]): string {
  const headers = ['Email', 'Role', 'Created At'];
  const rows = users.map(u => [
    escapeCsvField(u.email),
    escapeCsvField(u.role),
    escapeCsvField(formatDate(u.createdAt))
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

function generateAuditLogsCsv(logs: AuditLog[]): string {
  const headers = ['Action', 'Voucher ID', 'User Email', 'Timestamp', 'Details'];
  const rows = logs.map(l => [
    escapeCsvField(l.action),
    escapeCsvField(l.voucherId),
    escapeCsvField(l.userEmail),
    escapeCsvField(formatDate(l.timestamp)),
    escapeCsvField(l.details ? JSON.stringify(l.details) : '')
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

function validateStrongPassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter (A-Z)");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter (a-z)");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number (0-9)");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&* etc.)");
  }
  
  return { isValid: errors.length === 0, errors };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.session.userRole !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoint for debugging
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      // Check database connection
      const userCount = await storage.getAllUsers();
      console.log("Health check - users in database:", userCount.length);
      return res.json({ 
        status: "ok", 
        database: "connected",
        userCount: userCount.length,
        environment: process.env.NODE_ENV || "development"
      });
    } catch (error: any) {
      console.error("Health check failed:", error.message);
      return res.status(500).json({ 
        status: "error", 
        database: "disconnected",
        error: error.message 
      });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      console.log("Login attempt for:", req.body.email);
      
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        console.log("Validation failed:", parseResult.error.errors[0].message);
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { email, password } = parseResult.data;
      console.log("Looking up user:", email);
      
      const user = await storage.getUserByEmail(email);
      console.log("User found:", user ? "yes" : "no");

      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log("Password valid:", isValidPassword);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userRole = user.role;

      console.log("Login successful for:", email);
      
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error("Login error:", error.message, error.stack);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      return res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  });

  // User management routes (admin only)
  app.get("/api/users", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      return res.json(
        users.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
          created_at: u.createdAt?.toISOString(),
        }))
      );
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = createUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { email, password, role } = parseResult.data;

      const passwordCheck = validateStrongPassword(password);
      if (!passwordCheck.isValid) {
        return res.status(400).json({ 
          error: "Password does not meet security requirements: " + passwordCheck.errors[0]
        });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        role,
        createdBy: req.session.userId,
      });

      return res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Voucher routes
  app.get("/api/vouchers", requireAuth, async (req: Request, res: Response) => {
    try {
      const { status, search, limit, offset } = req.query;
      const result = await storage.getVouchers({
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      return res.json(result);
    } catch (error) {
      console.error("Error fetching vouchers:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/vouchers/:barcode", requireAuth, async (req: Request, res: Response) => {
    try {
      const voucher = await storage.getVoucherByBarcode(req.params.barcode);
      if (!voucher) {
        return res.status(404).json({ error: "Voucher not found" });
      }
      return res.json(voucher);
    } catch (error) {
      console.error("Error fetching voucher:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/vouchers/redeem", requireAuth, async (req: Request, res: Response) => {
    try {
      const { barcode } = req.body;
      if (!barcode) {
        return res.status(400).json({ error: "Barcode is required" });
      }

      const voucher = await storage.getVoucherByBarcode(barcode);
      if (!voucher) {
        return res.json({
          success: false,
          message: "Voucher not found. Please check the barcode and try again.",
        });
      }

      if (voucher.status === "redeemed") {
        return res.json({
          success: false,
          message: "This voucher has already been redeemed.",
          voucher,
          redeemedBy: voucher.redeemedByEmail,
          redeemedAt: voucher.redeemedAt?.toISOString(),
        });
      }

      if (voucher.status === "voided") {
        return res.json({
          success: false,
          message: "This voucher has been voided and cannot be redeemed.",
        });
      }

      if (voucher.status === "expired") {
        return res.json({
          success: false,
          message: "This voucher has expired.",
        });
      }

      const redeemed = await storage.redeemVoucher(
        voucher.id,
        req.session.userId!,
        req.session.userEmail!
      );

      if (!redeemed) {
        return res.json({
          success: false,
          message: "Failed to redeem voucher. Please try again.",
        });
      }

      await storage.createAuditLog({
        action: "redeemed",
        voucherId: redeemed.id,
        userId: req.session.userId,
        userEmail: req.session.userEmail,
        details: { value: redeemed.value },
      });

      return res.json({
        success: true,
        message: `Voucher redeemed successfully! Value: R${redeemed.value}`,
        voucher: redeemed,
      });
    } catch (error) {
      console.error("Error redeeming voucher:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/vouchers/import", requireAuth, async (req: Request, res: Response) => {
    try {
      const { barcodes, batchNumber, bookNumber, value } = req.body;

      if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
        return res.status(400).json({ error: "Barcodes array is required" });
      }

      if (!batchNumber) {
        return res.status(400).json({ error: "Batch number is required" });
      }

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (const barcode of barcodes) {
        try {
          const existing = await storage.getVoucherByBarcode(barcode);
          if (existing) {
            results.failed++;
            if (results.errors.length < 10) {
              results.errors.push(`Barcode ${barcode}: Already exists`);
            }
            continue;
          }

          await storage.createVoucher({
            barcode,
            value: value || 50,
            status: "available",
            batchNumber,
            bookNumber: bookNumber || null,
          });
          results.success++;
        } catch (err: any) {
          results.failed++;
          if (results.errors.length < 10) {
            results.errors.push(`Barcode ${barcode}: ${err.message}`);
          }
        }
      }

      if (results.success > 0) {
        await storage.createAuditLog({
          action: "imported",
          voucherId: null,
          userId: req.session.userId,
          userEmail: req.session.userEmail,
          details: {
            batch_number: batchNumber,
            total_imported: results.success,
            total_failed: results.failed,
          },
        });
      }

      return res.json(results);
    } catch (error) {
      console.error("Error importing vouchers:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/vouchers/:id/void", requireAdmin, async (req: Request, res: Response) => {
    try {
      const voucher = await storage.voidVoucher(req.params.id);
      if (!voucher) {
        return res.status(404).json({ error: "Voucher not found" });
      }

      await storage.createAuditLog({
        action: "voided",
        voucherId: voucher.id,
        userId: req.session.userId,
        userEmail: req.session.userEmail,
        details: { barcode: voucher.barcode },
      });

      return res.json(voucher);
    } catch (error) {
      console.error("Error voiding voucher:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Setup endpoint - creates initial admin user if none exists
  app.post("/api/setup", async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      if (users.length > 0) {
        return res.status(400).json({ error: "Setup already completed. Users already exist." });
      }

      const parseResult = createUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { email, password, role } = parseResult.data;

      const passwordCheck = validateStrongPassword(password);
      if (!passwordCheck.isValid) {
        return res.status(400).json({ 
          error: "Password does not meet security requirements: " + passwordCheck.errors[0]
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        role: role || "admin",
      });

      return res.status(201).json({
        success: true,
        message: "Initial admin user created successfully",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Setup error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Audit logs / Reports
  app.get("/api/reports", requireAuth, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const logs = await storage.getAuditLogs({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      return res.json(logs);
    } catch (error) {
      console.error("Error fetching reports:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Accounts routes
  app.get("/api/accounts", requireAuth, async (req: Request, res: Response) => {
    try {
      const accounts = await storage.getAllAccounts();
      const accountsWithStats = await Promise.all(
        accounts.map(async (account) => {
          const stats = await storage.getAccountStats(account.id);
          return { ...account, ...stats };
        })
      );
      return res.json(accountsWithStats);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Account summaries - MUST be before :id route
  app.get("/api/accounts/summaries", requireAuth, async (req: Request, res: Response) => {
    try {
      const summaries = await storage.getAllAccountSummaries();
      return res.json(summaries);
    } catch (error) {
      console.error("Error fetching account summaries:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/accounts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      const stats = await storage.getAccountStats(account.id);
      return res.json({ ...account, ...stats });
    } catch (error) {
      console.error("Error fetching account:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/accounts", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, contactName, email, phone, notes } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Account name is required" });
      }
      const account = await storage.createAccount({
        name: name.trim(),
        contactName: contactName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        createdBy: req.session.userId,
      });
      return res.status(201).json(account);
    } catch (error) {
      console.error("Error creating account:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/accounts/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, contactName, email, phone, notes } = req.body;
      const account = await storage.updateAccount(req.params.id, {
        name: name?.trim(),
        contactName: contactName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
      });
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      return res.json(account);
    } catch (error) {
      console.error("Error updating account:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/redemptions", requireAuth, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, groupBy } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      const period = (groupBy as 'day' | 'week' | 'month') || 'day';
      
      const data = await storage.getRedemptionsByPeriod(start, end, period);
      return res.json(data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/accounts/:id/summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const summary = await storage.getAccountSummary(req.params.id);
      if (!summary) {
        return res.status(404).json({ error: "Account not found" });
      }
      return res.json(summary);
    } catch (error) {
      console.error("Error fetching account summary:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Account purchases
  app.get("/api/accounts/:id/purchases", requireAuth, async (req: Request, res: Response) => {
    try {
      const purchases = await storage.getAccountPurchases(req.params.id);
      return res.json(purchases);
    } catch (error) {
      console.error("Error fetching account purchases:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/accounts/:id/purchases", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amountRands, notes } = req.body;
      if (!amountRands || amountRands <= 0) {
        return res.status(400).json({ error: "Amount in Rands is required and must be positive" });
      }
      
      if (amountRands % 50 !== 0) {
        return res.status(400).json({ error: "Amount must be a multiple of R50 (e.g., R50, R100, R150)" });
      }
      
      const amountCents = Math.round(amountRands * 100);
      const voucherCount = amountRands / 50;
      
      const purchase = await storage.createAccountPurchase({
        accountId: req.params.id,
        amountCents,
        voucherCount,
        unitValueCents: 5000,
        purchaseDate: new Date(),
        notes: notes?.trim() || null,
        createdBy: req.session.userId,
      });
      
      return res.status(201).json(purchase);
    } catch (error) {
      console.error("Error creating account purchase:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Export routes (admin only)
  app.get("/api/exports/vouchers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const vouchers = await storage.getAllVouchersForExport();
      const csv = generateVouchersCsv(vouchers);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="vouchers_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error("Error exporting vouchers:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/exports/accounts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const summaries = await storage.getAllAccountSummaries();
      const csv = generateAccountsCsv(summaries);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="accounts_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error("Error exporting accounts:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/exports/purchases", requireAdmin, async (req: Request, res: Response) => {
    try {
      const purchases = await storage.getAllAccountPurchasesForExport();
      const accounts = await storage.getAllAccounts();
      const accountMap = new Map(accounts.map(a => [a.id, a.name]));
      const csv = generatePurchasesCsv(purchases, accountMap);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="purchases_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error("Error exporting purchases:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/exports/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      const csv = generateUsersCsv(users);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="users_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error("Error exporting users:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/exports/audit-logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getAllAuditLogsForExport();
      const csv = generateAuditLogsCsv(logs);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/exports/all", requireAdmin, async (req: Request, res: Response) => {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      
      const vouchers = await storage.getAllVouchersForExport();
      const summaries = await storage.getAllAccountSummaries();
      const purchases = await storage.getAllAccountPurchasesForExport();
      const accounts = await storage.getAllAccounts();
      const accountMap = new Map(accounts.map(a => [a.id, a.name]));
      const allUsers = await storage.getAllUsers();
      const logs = await storage.getAllAuditLogsForExport();
      
      let combined = `SuperSave Data Export - ${dateStr}\n`;
      combined += `${'='.repeat(60)}\n\n`;
      
      combined += `VOUCHERS\n${'='.repeat(60)}\n`;
      combined += generateVouchersCsv(vouchers) + '\n\n';
      
      combined += `ACCOUNTS\n${'='.repeat(60)}\n`;
      combined += generateAccountsCsv(summaries) + '\n\n';
      
      combined += `PURCHASES\n${'='.repeat(60)}\n`;
      combined += generatePurchasesCsv(purchases, accountMap) + '\n\n';
      
      combined += `USERS\n${'='.repeat(60)}\n`;
      combined += generateUsersCsv(allUsers) + '\n\n';
      
      combined += `AUDIT LOGS\n${'='.repeat(60)}\n`;
      combined += generateAuditLogsCsv(logs);
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="supersave_complete_export_${dateStr}.txt"`);
      return res.send(combined);
    } catch (error) {
      console.error("Error exporting all data:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Password reset routes
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Send email using Resend
      console.log(`[AUTH] Forgot password request for: ${email}`);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log(`[AUTH] User not found for email: ${email}`);
        return res.json({ success: true, message: "If an account exists with this email, a reset link will be sent." });
      }

      console.log(`[AUTH] Found user: ${user.id}. Generating token...`);
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
        used: 0,
      });

      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
      console.log(`[AUTH] Reset link generated: ${resetLink}`);

      if (process.env.RESEND_API_KEY) {
        console.log("[AUTH] RESEND_API_KEY found, initializing Resend...");
        const resend = new Resend(process.env.RESEND_API_KEY);
        try {
          console.log("[AUTH] Attempting to send email via Resend...");
          const { data: emailData, error: emailError } = await resend.emails.send({
            from: 'SuperSave <vouchers@supersave.co.za>',
            to: email,
            subject: 'Reset Your SuperSave Password',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #84cc16;">SuperSave Password Reset</h2>
                <p>You requested to reset your password. Click the link below to set a new password:</p>
                <p style="margin: 24px 0;">
                  <a href="${resetLink}" style="background-color: #84cc16; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Reset Password
                  </a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="color: #666; word-break: break-all;">${resetLink}</p>
                <p style="color: #999; font-size: 12px; margin-top: 32px;">
                  This link expires in 1 hour. If you didn't request this, please ignore this email.
                </p>
              </div>
            `,
          });

          if (emailError) {
            console.error("[AUTH] Resend API error:", JSON.stringify(emailError, null, 2));
          } else {
            console.log("[AUTH] Resend success. ID:", emailData?.id);
          }
        } catch (error) {
          console.error("[AUTH] Unexpected error in Resend call:", error);
        }
      } else {
        console.error("[AUTH] RESEND_API_KEY is missing from environment!");
      }

      return res.json({ 
        success: true, 
        message: "If an account exists with this email, a reset link will be sent.",
        resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined,
      });
    } catch (error) {
      console.error("Error in forgot password:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      const passwordCheck = validateStrongPassword(password);
      if (!passwordCheck.isValid) {
        return res.status(400).json({ 
          error: "Password does not meet security requirements: " + passwordCheck.errors[0]
        });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      if (resetToken.used === 1) {
        return res.status(400).json({ error: "This reset token has already been used" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "Reset token has expired" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }

      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, resetToken.userId));
      await storage.markPasswordResetTokenUsed(token);

      return res.json({ success: true, message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}
