import { z } from "zod";

// Voucher status enum
export const VoucherStatus = {
  AVAILABLE: 'available',
  REDEEMED: 'redeemed',
  EXPIRED: 'expired',
  VOIDED: 'voided'
} as const;

export type VoucherStatusType = typeof VoucherStatus[keyof typeof VoucherStatus];

// Voucher schema
export const voucherSchema = z.object({
  id: z.string().uuid(),
  barcode: z.string().min(1),
  value: z.number().default(50),
  status: z.enum(['available', 'redeemed', 'expired', 'voided']),
  batch_number: z.string(),
  created_at: z.string(),
  redeemed_at: z.string().nullable(),
  redeemed_by: z.string().nullable(),
  redeemed_by_email: z.string().nullable().optional()
});

export type Voucher = z.infer<typeof voucherSchema>;

export const insertVoucherSchema = z.object({
  barcode: z.string().min(1, "Barcode is required"),
  value: z.number().default(50),
  status: z.enum(['available', 'redeemed', 'expired', 'voided']).default('available'),
  batch_number: z.string().min(1, "Batch number is required")
});

export type InsertVoucher = z.infer<typeof insertVoucherSchema>;

// Audit log schema
export const auditActionSchema = z.enum(['created', 'redeemed', 'voided', 'expired', 'imported']);

export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  action: auditActionSchema,
  voucher_id: z.string().uuid().nullable(),
  user_id: z.string(),
  user_email: z.string().optional(),
  timestamp: z.string(),
  details: z.record(z.any()).nullable()
});

export type AuditLog = z.infer<typeof auditLogSchema>;

export const insertAuditLogSchema = z.object({
  action: auditActionSchema,
  voucher_id: z.string().uuid().nullable(),
  user_id: z.string(),
  details: z.record(z.any()).nullable().optional()
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Dashboard stats
export interface DashboardStats {
  totalVouchers: number;
  availableVouchers: number;
  redeemedToday: number;
  redeemedTotal: number;
  totalValue: number;
  redeemedValue: number;
}

// Import result
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// Redemption result
export interface RedemptionResult {
  success: boolean;
  message: string;
  voucher?: Voucher;
  redeemedBy?: string;
  redeemedAt?: string;
}
