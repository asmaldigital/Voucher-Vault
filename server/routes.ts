import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { createUserSchema, loginSchema, insertVoucherSchema } from "@shared/schema";
import bcrypt from "bcryptjs";

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
      const { barcodes, batchNumber, value } = req.body;

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

  return httpServer;
}
