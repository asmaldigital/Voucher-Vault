import {
  users,
  vouchers,
  auditLogs,
  accounts,
  passwordResetTokens,
  type User,
  type InsertUser,
  type Voucher,
  type InsertVoucher,
  type AuditLog,
  type InsertAuditLog,
  type Account,
  type InsertAccount,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type DashboardStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, gte, like, or, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Voucher operations
  getVoucher(id: string): Promise<Voucher | undefined>;
  getVoucherByBarcode(barcode: string): Promise<Voucher | undefined>;
  getVouchers(options?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ vouchers: Voucher[]; total: number }>;
  createVoucher(voucher: InsertVoucher): Promise<Voucher>;
  createVouchers(vouchers: InsertVoucher[]): Promise<Voucher[]>;
  redeemVoucher(
    id: string,
    userId: string,
    userEmail: string
  ): Promise<Voucher | undefined>;
  voidVoucher(id: string): Promise<Voucher | undefined>;

  // Audit log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(options?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditLog[]>;

  // Dashboard stats
  getDashboardStats(): Promise<DashboardStats>;

  // Account operations
  getAccount(id: string): Promise<Account | undefined>;
  getAllAccounts(): Promise<Account[]>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined>;
  getAccountStats(accountId: string): Promise<{ totalVouchers: number; availableVouchers: number; redeemedVouchers: number; totalValue: number; availableValue: number }>;

  // Password reset operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;

  // Analytics
  getRedemptionsByPeriod(startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month'): Promise<{ period: string; count: number; value: number }[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Voucher operations
  async getVoucher(id: string): Promise<Voucher | undefined> {
    const [voucher] = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.id, id));
    return voucher || undefined;
  }

  async getVoucherByBarcode(barcode: string): Promise<Voucher | undefined> {
    const [voucher] = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.barcode, barcode));
    return voucher || undefined;
  }

  async getVouchers(options?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ vouchers: Voucher[]; total: number }> {
    const conditions = [];

    if (options?.status && options.status !== "all") {
      conditions.push(eq(vouchers.status, options.status));
    }

    if (options?.search) {
      conditions.push(
        or(
          like(vouchers.barcode, `%${options.search}%`),
          like(vouchers.batchNumber, `%${options.search}%`),
          like(vouchers.bookNumber, `%${options.search}%`)
        )
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers)
      .where(whereClause);

    const result = await db
      .select()
      .from(vouchers)
      .where(whereClause)
      .orderBy(desc(vouchers.createdAt))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return { vouchers: result, total: count };
  }

  async createVoucher(voucher: InsertVoucher): Promise<Voucher> {
    const [created] = await db.insert(vouchers).values(voucher).returning();
    return created;
  }

  async createVouchers(voucherList: InsertVoucher[]): Promise<Voucher[]> {
    if (voucherList.length === 0) return [];
    return db.insert(vouchers).values(voucherList).returning();
  }

  async redeemVoucher(
    id: string,
    userId: string,
    userEmail: string
  ): Promise<Voucher | undefined> {
    const [updated] = await db
      .update(vouchers)
      .set({
        status: "redeemed",
        redeemedAt: new Date(),
        redeemedBy: userId,
        redeemedByEmail: userEmail,
      })
      .where(and(eq(vouchers.id, id), eq(vouchers.status, "available")))
      .returning();
    return updated || undefined;
  }

  async voidVoucher(id: string): Promise<Voucher | undefined> {
    const [updated] = await db
      .update(vouchers)
      .set({ status: "voided" })
      .where(eq(vouchers.id, id))
      .returning();
    return updated || undefined;
  }

  // Audit log operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(options?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditLog[]> {
    const conditions = [];

    if (options?.startDate) {
      conditions.push(gte(auditLogs.timestamp, options.startDate));
    }

    if (options?.endDate) {
      const endOfDay = new Date(options.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(sql`${auditLogs.timestamp} <= ${endOfDay}`);
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp));
  }

  // Dashboard stats
  async getDashboardStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers);

    const [availableResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers)
      .where(eq(vouchers.status, "available"));

    const [redeemedTodayResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers)
      .where(
        and(eq(vouchers.status, "redeemed"), gte(vouchers.redeemedAt, today))
      );

    const [redeemedTotalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers)
      .where(eq(vouchers.status, "redeemed"));

    const [totalValueResult] = await db
      .select({ sum: sql<number>`coalesce(sum(value), 0)::int` })
      .from(vouchers);

    const [redeemedValueResult] = await db
      .select({ sum: sql<number>`coalesce(sum(value), 0)::int` })
      .from(vouchers)
      .where(eq(vouchers.status, "redeemed"));

    return {
      totalVouchers: totalResult.count,
      availableVouchers: availableResult.count,
      redeemedToday: redeemedTodayResult.count,
      redeemedTotal: redeemedTotalResult.count,
      totalValue: totalValueResult.sum,
      redeemedValue: redeemedValueResult.sum,
    };
  }

  // Account operations
  async getAccount(id: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || undefined;
  }

  async getAllAccounts(): Promise<Account[]> {
    return db.select().from(accounts).orderBy(desc(accounts.createdAt));
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [created] = await db.insert(accounts).values(account).returning();
    return created;
  }

  async updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined> {
    const [updated] = await db.update(accounts).set(account).where(eq(accounts.id, id)).returning();
    return updated || undefined;
  }

  async getAccountStats(accountId: string): Promise<{ totalVouchers: number; availableVouchers: number; redeemedVouchers: number; totalValue: number; availableValue: number }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(value), 0)::int` })
      .from(vouchers)
      .where(eq(vouchers.accountId, accountId));

    const [availableResult] = await db
      .select({ count: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(value), 0)::int` })
      .from(vouchers)
      .where(and(eq(vouchers.accountId, accountId), eq(vouchers.status, "available")));

    const [redeemedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers)
      .where(and(eq(vouchers.accountId, accountId), eq(vouchers.status, "redeemed")));

    return {
      totalVouchers: totalResult?.count || 0,
      availableVouchers: availableResult?.count || 0,
      redeemedVouchers: redeemedResult?.count || 0,
      totalValue: totalResult?.sum || 0,
      availableValue: availableResult?.sum || 0,
    };
  }

  // Password reset operations
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [created] = await db.insert(passwordResetTokens).values(token).returning();
    return created;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [result] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return result || undefined;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens).set({ used: 1 }).where(eq(passwordResetTokens.token, token));
  }

  // Analytics
  async getRedemptionsByPeriod(startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month'): Promise<{ period: string; count: number; value: number }[]> {
    let dateFormat: string;
    switch (groupBy) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'IYYY-IW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
    }

    const result = await db
      .select({
        period: sql<string>`to_char(${vouchers.redeemedAt}, ${dateFormat})`,
        count: sql<number>`count(*)::int`,
        value: sql<number>`coalesce(sum(${vouchers.value}), 0)::int`,
      })
      .from(vouchers)
      .where(
        and(
          eq(vouchers.status, "redeemed"),
          gte(vouchers.redeemedAt, startDate),
          sql`${vouchers.redeemedAt} <= ${endDate}`
        )
      )
      .groupBy(sql`to_char(${vouchers.redeemedAt}, ${dateFormat})`)
      .orderBy(sql`to_char(${vouchers.redeemedAt}, ${dateFormat})`);

    return result.filter(r => r.period !== null) as { period: string; count: number; value: number }[];
  }
}

export const storage = new DatabaseStorage();
