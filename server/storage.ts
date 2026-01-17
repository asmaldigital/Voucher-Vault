import {
  users,
  vouchers,
  auditLogs,
  accounts,
  accountPurchases,
  accountRedemptions,
  passwordResetTokens,
  type User,
  type InsertUser,
  type Voucher,
  type InsertVoucher,
  type AuditLog,
  type InsertAuditLog,
  type Account,
  type InsertAccount,
  type AccountPurchase,
  type InsertAccountPurchase,
  type AccountRedemption,
  type InsertAccountRedemption,
  type AccountSummary,
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
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Voucher operations
  getVoucher(id: string): Promise<Voucher | undefined>;
  getVoucherByBarcode(barcode: string): Promise<Voucher | undefined>;
  getVouchers(options?: {
    status?: string;
    search?: string;
    accountId?: string;
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
  getAccountSummary(accountId: string): Promise<AccountSummary | undefined>;
  getAllAccountSummaries(): Promise<AccountSummary[]>;

  // Account purchase operations
  getAccountPurchases(accountId: string): Promise<AccountPurchase[]>;
  createAccountPurchase(purchase: InsertAccountPurchase): Promise<AccountPurchase>;
  
  // Account redemption operations
  getAccountRedemptions(accountId: string): Promise<AccountRedemption[]>;
  createAccountRedemption(redemption: InsertAccountRedemption): Promise<AccountRedemption>;
  getAccountTotalRedemptions(accountId: string): Promise<number>;

  // Export operations
  getAllVouchersForExport(): Promise<Voucher[]>;
  getAllAuditLogsForExport(): Promise<AuditLog[]>;
  getAllAccountPurchasesForExport(): Promise<AccountPurchase[]>;
  getUniqueBookNumbers(): Promise<string[]>;

  // Password reset operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;

  // Analytics
  getRedemptionsByPeriod(startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month'): Promise<{ period: string; count: number; value: number }[]>;
  
  // Book-based reporting
  getBookStats(): Promise<{ bookNumber: string; total: number; available: number; redeemed: number; expired: number; voided: number; totalValue: number; availableValue: number; redeemedValue: number }[]>;
  getBookRedemptionsByPeriod(bookNumber: string, startDate: Date, endDate: Date): Promise<{ date: string; count: number; value: number }[]>;
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

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
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
    accountId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ vouchers: Voucher[]; total: number }> {
    const conditions = [];

    if (options?.status && options.status !== "all") {
      conditions.push(eq(vouchers.status, options.status));
    }

    if (options?.accountId) {
      conditions.push(eq(vouchers.accountId, options.accountId));
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

  async getAccountSummary(accountId: string): Promise<AccountSummary | undefined> {
    const account = await this.getAccount(accountId);
    if (!account) return undefined;

    const [purchaseResult] = await db
      .select({ 
        totalAmount: sql<number>`coalesce(sum(amount_cents), 0)::int`,
        totalVouchers: sql<number>`coalesce(sum(voucher_count), 0)::int`
      })
      .from(accountPurchases)
      .where(eq(accountPurchases.accountId, accountId));

    const [allocatedResult] = await db
      .select({ 
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(value), 0)::int`
      })
      .from(vouchers)
      .where(eq(vouchers.accountId, accountId));

    const [redeemedResult] = await db
      .select({ 
        count: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(value), 0)::int`
      })
      .from(vouchers)
      .where(and(eq(vouchers.accountId, accountId), eq(vouchers.status, "redeemed")));

    // Get manual redemptions total
    const manualRedemptionsTotal = await this.getAccountTotalRedemptions(accountId);

    const totalPurchased = purchaseResult?.totalAmount || 0;
    const totalAllocated = allocatedResult?.sum || 0;
    const totalRedeemed = redeemedResult?.sum || 0;
    // Total redeemed includes voucher redemptions + manual fund redemptions
    const totalRedeemedWithManual = totalRedeemed + (manualRedemptionsTotal / 100);

    return {
      ...account,
      totalPurchased: totalPurchased / 100,
      totalAllocated: totalAllocated,
      totalRedeemed: totalRedeemedWithManual,
      remainingBalance: (totalPurchased / 100) - totalRedeemedWithManual,
      vouchersPurchased: purchaseResult?.totalVouchers || 0,
      vouchersAllocated: allocatedResult?.count || 0,
      vouchersRedeemed: redeemedResult?.count || 0,
    };
  }

  async getAllAccountSummaries(): Promise<AccountSummary[]> {
    const allAccounts = await this.getAllAccounts();
    const summaries: AccountSummary[] = [];
    for (const account of allAccounts) {
      const summary = await this.getAccountSummary(account.id);
      if (summary) summaries.push(summary);
    }
    return summaries;
  }

  // Account purchase operations
  async getAccountPurchases(accountId: string): Promise<AccountPurchase[]> {
    return db.select().from(accountPurchases)
      .where(eq(accountPurchases.accountId, accountId))
      .orderBy(desc(accountPurchases.purchaseDate));
  }

  async createAccountPurchase(purchase: InsertAccountPurchase): Promise<AccountPurchase> {
    const [created] = await db.insert(accountPurchases).values(purchase).returning();
    return created;
  }

  // Export operations
  async getAllVouchersForExport(): Promise<Voucher[]> {
    return db.select().from(vouchers).orderBy(desc(vouchers.createdAt));
  }

  async getAllAuditLogsForExport(): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
  }

  async getAllAccountPurchasesForExport(): Promise<AccountPurchase[]> {
    return db.select().from(accountPurchases).orderBy(desc(accountPurchases.purchaseDate));
  }

  async getUniqueBookNumbers(): Promise<string[]> {
    const result = await db
      .selectDistinct({ bookNumber: vouchers.bookNumber })
      .from(vouchers)
      .where(sql`${vouchers.bookNumber} IS NOT NULL AND ${vouchers.bookNumber} != ''`)
      .orderBy(vouchers.bookNumber);
    
    return result.map(r => r.bookNumber).filter((b): b is string => b !== null);
  }

  // Account redemption operations
  async getAccountRedemptions(accountId: string): Promise<AccountRedemption[]> {
    return db
      .select()
      .from(accountRedemptions)
      .where(eq(accountRedemptions.accountId, accountId))
      .orderBy(desc(accountRedemptions.redemptionDate));
  }

  async createAccountRedemption(redemption: InsertAccountRedemption): Promise<AccountRedemption> {
    const [created] = await db.insert(accountRedemptions).values(redemption).returning();
    return created;
  }

  async getAccountTotalRedemptions(accountId: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${accountRedemptions.amountCents}), 0)` })
      .from(accountRedemptions)
      .where(eq(accountRedemptions.accountId, accountId));
    return Number(result[0]?.total || 0);
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

  // Book-based reporting
  async getBookStats(): Promise<{ bookNumber: string; total: number; available: number; redeemed: number; expired: number; voided: number; totalValue: number; availableValue: number; redeemedValue: number }[]> {
    const result = await db
      .select({
        bookNumber: sql<string>`COALESCE(${vouchers.bookNumber}, ${vouchers.batchNumber})`,
        total: sql<number>`count(*)::int`,
        available: sql<number>`count(*) FILTER (WHERE ${vouchers.status} = 'available')::int`,
        redeemed: sql<number>`count(*) FILTER (WHERE ${vouchers.status} = 'redeemed')::int`,
        expired: sql<number>`count(*) FILTER (WHERE ${vouchers.status} = 'expired')::int`,
        voided: sql<number>`count(*) FILTER (WHERE ${vouchers.status} = 'voided')::int`,
        totalValue: sql<number>`COALESCE(SUM(${vouchers.value}), 0)::int`,
        availableValue: sql<number>`COALESCE(SUM(CASE WHEN ${vouchers.status} = 'available' THEN ${vouchers.value} ELSE 0 END), 0)::int`,
        redeemedValue: sql<number>`COALESCE(SUM(CASE WHEN ${vouchers.status} = 'redeemed' THEN ${vouchers.value} ELSE 0 END), 0)::int`,
      })
      .from(vouchers)
      .groupBy(sql`COALESCE(${vouchers.bookNumber}, ${vouchers.batchNumber})`)
      .orderBy(sql`COALESCE(${vouchers.bookNumber}, ${vouchers.batchNumber})`);
    
    return result.filter(r => r.bookNumber !== null) as { bookNumber: string; total: number; available: number; redeemed: number; expired: number; voided: number; totalValue: number; availableValue: number; redeemedValue: number }[];
  }

  async getBookRedemptionsByPeriod(bookNumber: string, startDate: Date, endDate: Date): Promise<{ date: string; count: number; value: number }[]> {
    const result = await db
      .select({
        date: sql<string>`to_char(${vouchers.redeemedAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        value: sql<number>`COALESCE(SUM(${vouchers.value}), 0)::int`,
      })
      .from(vouchers)
      .where(
        and(
          eq(vouchers.status, "redeemed"),
          sql`COALESCE(${vouchers.bookNumber}, ${vouchers.batchNumber}) = ${bookNumber}`,
          gte(vouchers.redeemedAt, startDate),
          sql`${vouchers.redeemedAt} <= ${endDate}`
        )
      )
      .groupBy(sql`to_char(${vouchers.redeemedAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${vouchers.redeemedAt}, 'YYYY-MM-DD')`);
    
    return result.filter(r => r.date !== null) as { date: string; count: number; value: number }[];
  }
}

export const storage = new DatabaseStorage();
