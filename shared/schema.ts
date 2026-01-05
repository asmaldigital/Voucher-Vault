import { pgTable, text, integer, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table for authentication
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("editor"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: uuid("created_by"),
});

export const usersRelations = relations(users, ({ many }) => ({
  vouchers: many(vouchers),
  auditLogs: many(auditLogs),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Vouchers table
export const vouchers = pgTable("vouchers", {
  id: uuid("id").primaryKey().defaultRandom(),
  barcode: text("barcode").notNull().unique(),
  value: integer("value").notNull().default(50),
  status: text("status").notNull().default("available"),
  batchNumber: text("batch_number").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  redeemedAt: timestamp("redeemed_at"),
  redeemedBy: uuid("redeemed_by").references(() => users.id),
  redeemedByEmail: text("redeemed_by_email"),
});

export const vouchersRelations = relations(vouchers, ({ one }) => ({
  redeemedByUser: one(users, {
    fields: [vouchers.redeemedBy],
    references: [users.id],
  }),
}));

export const insertVoucherSchema = createInsertSchema(vouchers).omit({
  id: true,
  createdAt: true,
  redeemedAt: true,
  redeemedBy: true,
  redeemedByEmail: true,
});

export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchers.$inferSelect;

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(),
  voucherId: uuid("voucher_id").references(() => vouchers.id),
  userId: uuid("user_id").references(() => users.id),
  userEmail: text("user_email"),
  timestamp: timestamp("timestamp").defaultNow(),
  details: jsonb("details"),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  voucher: one(vouchers, {
    fields: [auditLogs.voucherId],
    references: [vouchers.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Zod schemas for validation
export const createUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "editor"]).default("editor"),
});

export type CreateUser = z.infer<typeof createUserSchema>;

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

// Voucher status enum
export const VoucherStatus = {
  AVAILABLE: "available",
  REDEEMED: "redeemed",
  EXPIRED: "expired",
  VOIDED: "voided",
} as const;

export type VoucherStatusType = (typeof VoucherStatus)[keyof typeof VoucherStatus];

// User roles
export const UserRole = {
  ADMIN: "admin",
  EDITOR: "editor",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

// Dashboard stats interface
export interface DashboardStats {
  totalVouchers: number;
  availableVouchers: number;
  redeemedToday: number;
  redeemedTotal: number;
  totalValue: number;
  redeemedValue: number;
}

// Import result interface
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// Redemption result interface
export interface RedemptionResult {
  success: boolean;
  message: string;
  voucher?: Voucher;
  redeemedBy?: string;
  redeemedAt?: string;
}
